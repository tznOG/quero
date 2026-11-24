'use client';

import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { WishCategory, WishItem } from '../lib/types';

export default function CategoryManager({
  categories,
  items,
  onChange,
}: {
  categories: WishCategory[];
  items: WishItem[];
  onChange: (method: 'POST' | 'PATCH' | 'DELETE', id?: string, name?: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(method: 'POST' | 'PATCH' | 'DELETE', id?: string, value?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onChange(method, id, value);
      if (method === 'POST') setName('');
      setEditing(null);
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar a categoria.');
    } finally {
      setBusy(false);
    }
  }

  function create(e: FormEvent) {
    e.preventDefault();
    void save('POST', undefined, name);
  }

  return (
    <div className="category-manager">
      <p className="modal-description">
        Organize seus desejos com categorias próprias. Elas ficam disponíveis em todas as suas
        listas.
      </p>
      <form className="form category-create" onSubmit={create}>
        <label>
          Nome da categoria
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
            placeholder="Ex.: Viagens, Jogos, Artesanato"
            disabled={busy || categories.length >= 50}
          />
        </label>
        <button
          className="button primary"
          disabled={busy || !name.trim() || categories.length >= 50}
        >
          <Plus size={16} /> Criar categoria
        </button>
      </form>
      <p className="category-count">{categories.length} de 50 categorias</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!categories.length && (
        <p>Você ainda não tem categorias. Seus desejos podem ficar sem categoria.</p>
      )}
      <ul className="category-list" aria-label="Suas categorias">
        {categories.map((category) => {
          const count = items.filter((item) => item.category === category.name).length;
          return (
            <li key={category.id} className="category-row">
              {editing === category.id ? (
                <form
                  className="form category-edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save('PATCH', category.id, editName);
                  }}
                >
                  <label>
                    Novo nome
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={40}
                      required
                      disabled={busy}
                    />
                  </label>
                  <div className="category-actions">
                    <button className="button primary" disabled={busy || !editName.trim()}>
                      Salvar nome
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => setEditing(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="category-summary">
                  <div>
                    <strong>{category.name}</strong>
                    <small>
                      {count} {count === 1 ? 'desejo' : 'desejos'}
                    </small>
                  </div>
                  <div className="category-actions">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Renomear ${category.name}`}
                      disabled={busy}
                      onClick={() => {
                        setEditing(category.id);
                        setEditName(category.name);
                        setDeleting(null);
                        setError('');
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Excluir ${category.name}`}
                      disabled={busy}
                      onClick={() => {
                        setDeleting(category.id);
                        setEditing(null);
                        setError('');
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              )}
              {deleting === category.id && (
                <div className="category-confirm">
                  <p>
                    Excluir a categoria “{category.name}”?{' '}
                    {count
                      ? `${count} ${count === 1 ? 'desejo ficará' : 'desejos ficarão'} como “Sem categoria”.`
                      : 'Nenhum desejo usa esta categoria.'}{' '}
                    Nenhum desejo será excluído.
                  </p>
                  <div className="category-actions">
                    <button
                      className="button destructive"
                      type="button"
                      disabled={busy}
                      onClick={() => void save('DELETE', category.id)}
                    >
                      Excluir categoria
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => setDeleting(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
