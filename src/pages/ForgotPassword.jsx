import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // Always show success regardless
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Définir votre mot de passe"
      subtitle="Nous vous envoyons un lien par email"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground">
            Un lien vient d'être envoyé à <strong className="break-all">{email}</strong>.
            Pensez à vérifier vos indésirables.
          </p>
          {/* Un compte jamais utilisé n'existe pas encore : aucun lien ne peut
              partir. On propose alors de créer l'accès directement. */}
          <div className="rounded-lg border border-gd-orange/40 bg-gd-orange/5 p-3">
            <p className="text-sm font-semibold text-gd-navy-dark">Vous ne recevez rien ?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              C'est que votre accès n'est pas encore actif. Créez-le avec cette même adresse,
              vous choisirez votre mot de passe.
            </p>
            <Link
              to={`/register?email=${encodeURIComponent(email)}`}
              className="mt-2 inline-block text-sm font-semibold text-gd-orange underline underline-offset-2 hover:text-gd-navy"
            >
              Créer mon accès
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Votre adresse professionnelle</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Recevoir le lien"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
