'use client';

import { useState, type FormEvent } from 'react';

export default function SecurityForm({
  onChanged,
}: {
  onChanged: (deleted: boolean) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      if (!deleting && data.password !== data.repeatPassword)
        throw new Error('As novas senhas não conferem.');
      const response = await fetch('/api/auth/' + (deleting ? 'delete-account' : 'password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.');
      await onChanged(deleting);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <p className="modal-description">
        {deleting
          ? 'A exclusão é permanente: suas listas, desejos, reservas e dados de conta serão removidos. Baixe seus dados na tela anterior se quiser guardá-los.'
          : 'Ao alterar a senha, os outros dispositivos serão desconectados.'}
      </p>
      <label>
        Senha atual
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      {deleting ? (
        <label>
          Digite EXCLUIR para confirmar
          <input name="confirmation" required pattern="EXCLUIR" autoComplete="off" />
        </label>
      ) : (
        <>
          <label>
            Nova senha
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <label>
            Repita a nova senha
            <input
              name="repeatPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className={'button full-width ' + (deleting ? 'destructive' : 'primary')}
        disabled={busy}
        type="submit"
      >
        {busy ? 'Salvando…' : deleting ? 'Excluir minha conta definitivamente' : 'Atualizar senha'}
      </button>
      <button
        className="text-button danger"
        disabled={busy}
        type="button"
        onClick={() => {
          setDeleting(!deleting);
          setError('');
        }}
      >
        {deleting ? 'Voltar para alterar senha' : 'Quero excluir minha conta'}
      </button>
    </form>
  );
}
