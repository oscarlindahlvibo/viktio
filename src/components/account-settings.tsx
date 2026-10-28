import { useState } from 'react';
import { Download, FileText, Loader2, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/providers/auth-provider';
import { Link, useRouter } from '@/lib/navigation';
import { deleteMyAccount, exportMyData } from '@/lib/privacy';

export function AccountSettings() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportMyData(user.id, user.email);
    } catch {
      toast.error('Kunde inte exportera din data');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMyAccount();
      toast.success('Ditt konto är raderat');
      router.replace('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte radera kontot');
      setDeleting(false);
    }
  };

  return (
    <Card className="p-5 rounded-2xl mb-4">
      <h2 className="font-semibold mb-1">Konto och integritet</h2>
      <p className="text-xs text-muted-foreground mb-4">Inloggad som {user.email}</p>

      <div className="space-y-2">
        <Link href="/integritet" className="flex items-center gap-3 p-3 rounded-xl border border-border text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Integritetspolicy
        </Link>
        <button onClick={handleExport} disabled={exporting} className="w-full flex items-center gap-3 p-3 rounded-xl border border-border text-sm text-left">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-muted-foreground" />}
          Exportera min data
        </button>
        <button
          onClick={async () => {
            await signOut();
            router.replace('/login');
          }}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-border text-sm text-left"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
          Logga ut
        </button>
        <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-3 p-3 rounded-xl border border-destructive/30 text-sm text-left text-destructive">
          <Trash2 className="h-4 w-4" />
          Radera konto
        </button>
      </div>

      {confirmDelete && (
        <div className="mt-4 rounded-xl bg-destructive/5 border border-destructive/30 p-4 space-y-3">
          <p className="text-sm">
            All din data – vikt, matdagbok, träning och mål – raderas permanent och kan inte återställas.
            Skriv <strong>RADERA</strong> för att bekräfta.
          </p>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="h-11 rounded-xl" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setConfirmDelete(false); setConfirmText(''); }}>
              Avbryt
            </Button>
            <Button variant="destructive" className="flex-1 rounded-xl" disabled={confirmText !== 'RADERA' || deleting} onClick={handleDelete}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Radera för alltid'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
