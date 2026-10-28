
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from '@/lib/navigation';
import { Capacitor } from '@capacitor/core';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';
import { supabase } from '@/lib/supabase/client';
import { usePointEngineConfig } from '@/hooks/use-daily-data';
import { calculatePointsPer100g, formatPoints } from '@/lib/points';
import type { FoodSearchResult } from '@/lib/types';
import { ScanLine, X, Loader2, Camera, AlertCircle, Keyboard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FoodAddSheet } from '@/components/food-add-sheet';

export default function ScannerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mealType = searchParams.get('meal') || 'snack';
  const manualName = searchParams.get('name') || '';
  const { config } = usePointEngineConfig();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [scanning, setScanning] = useState(false);
  const [manualMode, setManualMode] = useState(manualName !== '');
  const [barcode, setBarcode] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundFood, setFoundFood] = useState<FoodSearchResult | null>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  // Manual food entry form
  const [manualFoodName, setManualFoodName] = useState(manualName);
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualSatFat, setManualSatFat] = useState('');
  const [manualFiber, setManualFiber] = useState('');
  const [manualSodium, setManualSodium] = useState('');
  const [manualPackageSize, setManualPackageSize] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const stopCamera = useCallback(() => {
    if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    setCameraError(false);

    // Native apps use the Capacitor scanner; WKWebView lacks BarcodeDetector.
    if (Capacitor.isNativePlatform()) {
      try {
        const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({
          hint: CapacitorBarcodeScannerTypeHint.ALL,
          scanInstructions: 'Rikta kameran mot streckkoden',
        });
        if (ScanResult) {
          setBarcode(ScanResult);
          searchBarcode(ScanResult);
        } else {
          setManualMode(true);
        }
      } catch {
        setError('Kunde inte starta skannern. Använd manuell sökning.');
        setCameraError(true);
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      // Use BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'upc_a'],
        });
        detectIntervalRef.current = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              stopCamera();
              setBarcode(barcodes[0].rawValue);
              searchBarcode(barcodes[0].rawValue);
            }
          } catch {
            // Detection errors are normal
          }
        }, 500);
      } else {
        setError('Streckkodsläsare stöds inte i denna webbläsare. Använd manuell sökning.');
        setCameraError(true);
      }
    } catch {
      setError('Kunde inte komma åt kameran. Använd manuell sökning.');
      setCameraError(true);
    }
  }, [stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const searchBarcode = async (code: string) => {
    setSearching(true);
    setNotFound(false);

    // Search internal database
    const { data } = await supabase
      .from('foods')
      .select(`
        id, name, brand, image_url, package_size, barcode, zero_point, status, serving_size_g, serving_description, manual_points,
        category:food_categories(name, slug),
        nutrition:food_nutrition(*)
      `)
      .eq('barcode', code)
      .maybeSingle();

    if (data) {
      const nutrition = (data.nutrition as Record<string, number>[])?.[0];
      if (nutrition) {
        const pointsPer100g = calculatePointsPer100g(
          {
            id: '',
            food_id: data.id,
            kcal: nutrition.kcal || 0,
            protein_g: nutrition.protein_g || 0,
            carbohydrate_g: nutrition.carbohydrate_g || 0,
            sugar_g: nutrition.sugar_g || 0,
            fat_g: nutrition.fat_g || 0,
            saturated_fat_g: nutrition.saturated_fat_g || 0,
            fiber_g: nutrition.fiber_g || 0,
            sodium_mg: nutrition.sodium_mg || 0,
            salt_g: nutrition.salt_g || 0,
            per_amount: nutrition.per_amount || 100,
            unit: String(nutrition.unit || 'g'),
          },
          data.zero_point,
          data.manual_points,
          config || undefined,
        );
        const servingG = data.serving_size_g;
        setFoundFood({
          id: data.id,
          name: data.name,
          brand: data.brand,
          image_url: data.image_url,
          package_size: data.package_size,
          barcode: data.barcode,
          zero_point: data.zero_point,
          status: data.status,
          kcal: nutrition.kcal || 0,
          protein_g: nutrition.protein_g || 0,
          points_per_100g: pointsPer100g,
          points_per_serving: servingG ? pointsPer100g * (servingG / 100) : pointsPer100g,
          serving_description: data.serving_description,
        });
        setSearching(false);
        return;
      }
    }

    // Not found locally — try Open Food Facts
    try {
      const { data, error: fnError } = await supabase.functions.invoke('food-search', { body: { barcode: code } });
      if (!fnError && data) {
        if (data.results && data.results.length > 0) {
          const r = data.results[0];
          const pointsPer100g = calculatePointsPer100g(
            {
              id: '', food_id: '',
              kcal: r.kcal, protein_g: r.protein_g,
              carbohydrate_g: r.carbohydrate_g, sugar_g: r.sugar_g,
              fat_g: r.fat_g, saturated_fat_g: r.saturated_fat_g,
              fiber_g: r.fiber_g, sodium_mg: r.sodium_mg,
              salt_g: 0, per_amount: 100, unit: 'g',
            },
            false, null, config || undefined,
          );
          setFoundFood({
            id: `off_${r.barcode || r.name}`,
            name: r.name,
            brand: r.brand,
            image_url: r.image_url,
            package_size: r.package_size,
            barcode: r.barcode,
            zero_point: false,
            status: 'estimated',
            kcal: r.kcal,
            protein_g: r.protein_g,
            points_per_100g: pointsPer100g,
            points_per_serving: pointsPer100g,
            serving_description: r.serving_description,
          });
          setSearching(false);
          return;
        }
      }
    } catch {
      // External lookup failed
    }

    // Not found anywhere
    setSearching(false);
    setNotFound(true);
  };

  const handleManualBarcodeSearch = () => {
    if (barcode.length >= 8) {
      searchBarcode(barcode);
    }
  };

  const handleSaveManual = async () => {
    if (!manualFoodName || !manualKcal) {
      toast.error('Fyll i minst namn och kalorier');
      return;
    }
    setSavingManual(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data: foodData } = await supabase
      .from('foods')
      .insert({
        name: manualFoodName,
        barcode: barcode || null,
        package_size: manualPackageSize || null,
        status: 'user_created',
        zero_point: false,
        created_by: user.user.id,
      })
      .select('id')
      .single();

    if (!foodData) {
      toast.error('Kunde inte spara maten');
      setSavingManual(false);
      return;
    }

    await supabase.from('food_nutrition').insert({
      food_id: foodData.id,
      kcal: parseFloat(manualKcal) || 0,
      protein_g: parseFloat(manualProtein) || 0,
      carbohydrate_g: parseFloat(manualCarbs) || 0,
      sugar_g: 0,
      fat_g: parseFloat(manualFat) || 0,
      saturated_fat_g: parseFloat(manualSatFat) || 0,
      fiber_g: parseFloat(manualFiber) || 0,
      sodium_mg: parseFloat(manualSodium) || 0,
      salt_g: 0,
      per_amount: 100,
      unit: 'g',
    });

    setSavingManual(false);
    toast.success('Mat sparad!');
    router.push('/app/mat/sok');
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-md mx-auto relative min-h-screen">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 safe-top">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-black/50 backdrop-blur text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-white font-medium">Skanna streckkod</span>
          <button
            onClick={() => {
              stopCamera();
              setManualMode(true);
            }}
            className="p-2 rounded-xl bg-black/50 backdrop-blur text-white"
          >
            <Keyboard className="h-5 w-5" />
          </button>
        </div>

        {/* Camera viewfinder */}
        {!manualMode && (
          <div className="relative h-screen flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Scan frame overlay */}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-44 border-2 border-white/70 rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center px-6 text-center">
                <AlertCircle className="h-12 w-12 text-white/50 mb-4" />
                <p className="text-white mb-4">{error}</p>
                <Button
                  onClick={() => {
                    setManualMode(true);
                    stopCamera();
                  }}
                  className="rounded-xl"
                >
                  Använd manuell sökning
                </Button>
              </div>
            )}

            {/* Bottom hint */}
            {scanning && !cameraError && (
              <div className="absolute bottom-24 left-0 right-0 text-center">
                <p className="text-white/80 text-sm">
                  Rikta kameran mot en streckkod
                </p>
              </div>
            )}
          </div>
        )}

        {/* Manual barcode entry */}
        {manualMode && !notFound && !foundFood && (
          <div className="min-h-screen bg-background px-6 pt-20">
            <h2 className="text-xl font-bold mb-4">Ange streckkod</h2>
            <Input
              type="text"
              inputMode="numeric"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="t.ex. 7310860030011"
              className="h-12 rounded-xl mb-3"
            />
            <Button
              onClick={handleManualBarcodeSearch}
              disabled={barcode.length < 8 || searching}
              className="w-full h-12 rounded-xl"
            >
              {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sök'}
            </Button>
          </div>
        )}

        {/* Searching */}
        {searching && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-white mx-auto mb-3" />
              <p className="text-white">Söker efter produkt...</p>
            </div>
          </div>
        )}

        {/* Not found */}
        {notFound && !searching && (
          <div className="min-h-screen bg-background px-6 pt-20">
            <div className="text-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold mb-2">Vi hittade inte produkten</h2>
              <p className="text-muted-foreground text-sm mb-1">Streckkod: {barcode}</p>
              <p className="text-muted-foreground text-sm mb-6">Lägg till den manuellt så kan andra användare hitta den senare.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Namn</label>
                <Input
                  value={manualFoodName}
                  onChange={(e) => setManualFoodName(e.target.value)}
                  placeholder="t.ex. Kycklingfilé 500g"
                  className="h-12 rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Förpackningsstorlek</label>
                <Input
                  value={manualPackageSize}
                  onChange={(e) => setManualPackageSize(e.target.value)}
                  placeholder="t.ex. 500 g"
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="text-sm font-medium pt-2">Näringsvärden per 100g:</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Kalorier (kcal)</label>
                  <Input type="number" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} className="h-12 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Protein (g)</label>
                  <Input type="number" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} className="h-12 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Kolhydrater (g)</label>
                  <Input type="number" value={manualCarbs} onChange={(e) => setManualCarbs(e.target.value)} className="h-12 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Fett (g)</label>
                  <Input type="number" value={manualFat} onChange={(e) => setManualFat(e.target.value)} className="h-12 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Mättat fett (g)</label>
                  <Input type="number" value={manualSatFat} onChange={(e) => setManualSatFat(e.target.value)} className="h-12 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Fiber (g)</label>
                  <Input type="number" value={manualFiber} onChange={(e) => setManualFiber(e.target.value)} className="h-12 rounded-xl" />
                </div>
              </div>
              <Button
                onClick={handleSaveManual}
                disabled={savingManual}
                className="w-full h-12 rounded-xl mt-2"
              >
                {savingManual ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Spara och lägg till'}
              </Button>
            </div>
          </div>
        )}

        {/* Found food */}
        {foundFood && !searching && (
          <FoodAddSheet
            food={foundFood}
            mealType={mealType}
            onClose={() => {
              setFoundFood(null);
              setNotFound(false);
              setBarcode('');
              router.back();
            }}
            onAdded={() => {
              setFoundFood(null);
              toast.success('Tillagt!');
              router.push('/app');
            }}
          />
        )}
      </div>
    </div>
  );
}
