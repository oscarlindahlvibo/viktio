import { ChevronLeft } from 'lucide-react';
import { useRouter } from '@/lib/navigation';
import { PRIVACY_POLICY_VERSION } from '@/lib/privacy';

// Draft policy: needs legal review before public launch.
export default function PrivacyPolicyPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-5 py-6">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ChevronLeft className="h-4 w-4" /> Tillbaka
        </button>
        <h1 className="text-2xl font-bold mb-1">Integritetspolicy</h1>
        <p className="text-xs text-muted-foreground mb-6">Version {PRIVACY_POLICY_VERSION}</p>

        <div className="space-y-5 text-sm leading-relaxed">
          <section>
            <h2 className="font-semibold mb-1">Vem ansvarar för dina uppgifter?</h2>
            <p>Vibogruppen är personuppgiftsansvarig för Viktio. Frågor om dina uppgifter skickar du till oscar@vibogruppen.se.</p>
          </section>
          <section>
            <h2 className="font-semibold mb-1">Vilka uppgifter behandlar vi?</h2>
            <p>
              E-post, namn, kön, födelsedatum, längd, vikt, mått, mål, matdagbok, träning, sömn, vatten, humör och vanor
              som du själv registrerar. Om du kopplar Apple Hälsa eller Health Connect läser vi steg och träningspass därifrån.
              Uppgifter om hälsa är känsliga personuppgifter och behandlas bara med ditt uttryckliga samtycke.
            </p>
          </section>
          <section>
            <h2 className="font-semibold mb-1">Varför?</h2>
            <p>För att räkna ut dina poäng och mål, visa din utveckling och ge dig råd i appen. Vi säljer aldrig dina uppgifter och använder dem inte för reklam.</p>
          </section>
          <section>
            <h2 className="font-semibold mb-1">Var lagras uppgifterna?</h2>
            <p>På vår egen server i Sverige. Uppgifterna sparas så länge du har ett konto.</p>
          </section>
          <section>
            <h2 className="font-semibold mb-1">Dina rättigheter</h2>
            <p>
              Du kan när som helst exportera all din data eller radera ditt konto under Profil → Konto och integritet.
              Du kan också återkalla ditt samtycke genom att radera kontot, begära rättelse och klaga hos Integritetsskyddsmyndigheten (IMY).
            </p>
          </section>
          <section>
            <h2 className="font-semibold mb-1">Inte medicinsk rådgivning</h2>
            <p>Viktio ger allmänna råd om kost, träning och livsstil och ersätter inte vård. Kontakta vården vid sjukdom, graviditet eller ätstörningsproblematik.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
