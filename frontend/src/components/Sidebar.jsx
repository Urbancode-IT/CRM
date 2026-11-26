import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api from '../services/api';
import BrandMark from './BrandMark';
import Modal from './Modal';
import { BRAND_NAME } from '../constants/brand';
import { useTheme } from '../context/ThemeContext';

function FolderIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
}

function PlusIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronIcon({ open, className = 'h-3.5 w-3.5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function TrashIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function HomeIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

function UsersIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a3 3 0 0 1 0 5.74" />
    </svg>
  );
}

function CalendarIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function WalletIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9z" />
      <path strokeLinecap="round" d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CheckListIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6h11M9 12h11M9 18h11M4.5 6.5l1 1 2-2M4.5 12.5l1 1 2-2M4.5 18.5l1 1 2-2" />
    </svg>
  );
}

function GridIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function FormIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h8M8 10h8M8 14h5" />
      <rect x="4" y="3" width="16" height="18" rx="2" />
    </svg>
  );
}

function FlowIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path strokeLinecap="round" d="M8.5 7.5 15.5 11M8.5 16.5 15.5 13" />
    </svg>
  );
}

function CardIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path strokeLinecap="round" d="M3 10h18" />
    </svg>
  );
}

function PageIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path strokeLinecap="round" d="M14 3v5h5" />
    </svg>
  );
}

const SECTION_ICON_META = {
  '/app': { color: '#e4cdcb', Icon: HomeIcon },
  '/app/students': { color: '#cda09d', Icon: UsersIcon },
  '/app/batches': { color: '#b8c4a8', Icon: CalendarIcon },
  '/app/instructors': { color: '#a8b0c9', Icon: UsersIcon },
  '/app/attendance': { color: '#e8c9a0', Icon: CalendarIcon },
  '/app/payments': { color: '#d4a09c', Icon: WalletIcon },
  '/app/tasks': { color: '#c9b0a8', Icon: CheckListIcon },
  '/app/modules': { color: '#b89a98', Icon: GridIcon },
  '/app/forms': { color: '#d4b0a8', Icon: FormIcon },
  '/app/workflows': { color: '#c4a5a0', Icon: FlowIcon },
  '/app/reports': { color: '#a8b8c9', Icon: PageIcon },
  '/app/messages': { color: '#a8c4b8', Icon: PageIcon },
  '/app/recycle-bin': { color: '#c9a8a8', Icon: TrashIcon },
  '/app/billing': { color: '#e0b89a', Icon: CardIcon },
};

function sectionVisual(section, fallbackColor) {
  if (section.path && SECTION_ICON_META[section.path]) {
    return SECTION_ICON_META[section.path];
  }
  if (section.linkedModuleId) {
    return { color: '#b89a98', Icon: GridIcon };
  }
  return { color: fallbackColor, Icon: PageIcon };
}

function PaletteIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3a9 9 0 0 0 0 18h1.5a2.5 2.5 0 0 0 0-5H13a1 1 0 0 1 0-2h3.5A9 9 0 0 0 12 3z"
      />
      <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Sidebar({ user, logout, open, onClose }) {
  const navigate = useNavigate();
  const { colors: BRAND_COLOR, openCustomize } = useTheme();
  const [modules, setModules] = useState([]);
  const [openMap, setOpenMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [nameDialog, setNameDialog] = useState(null);
  // { mode: 'module' | 'section', moduleId?, title, label, value }
  const [confirmDialog, setConfirmDialog] = useState(null);
  // { type: 'module' | 'section', moduleId, sectionId?, title, message }
  const [submitting, setSubmitting] = useState(false);

  function applyModules(list) {
    setModules(list);
    setOpenMap((prev) => {
      const next = { ...prev };
      list.forEach((m) => {
        if (next[m.id] === undefined) next[m.id] = true;
      });
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;

    function loadModules() {
      api
        .get('/modules')
        .then((res) => {
          if (cancelled) return;
          applyModules(res.data.modules || []);
          setError('');
        })
        .catch((err) => {
          if (!cancelled) setError(err.response?.data?.message || 'Failed to load modules');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    loadModules();
    const onModulesChanged = () => loadModules();
    window.addEventListener('tusion:modules-changed', onModulesChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('tusion:modules-changed', onModulesChanged);
    };
  }, []);

  function toggleModule(id) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openAddModule() {
    setNameDialog({
      mode: 'module',
      title: 'New module',
      label: 'Module name',
      value: '',
    });
  }

  function openAddSection(moduleId, e) {
    e.stopPropagation();
    setNameDialog({
      mode: 'section',
      moduleId,
      title: 'New section',
      label: 'Section name',
      value: '',
    });
  }

  async function submitNameDialog(e) {
    e.preventDefault();
    if (!nameDialog) return;
    const name = nameDialog.value.trim();
    if (!name) {
      setNotice('Name is required');
      return;
    }

    setSubmitting(true);
    setNotice('');
    try {
      if (nameDialog.mode === 'module') {
        const res = await api.post('/modules', { name });
        const created = res.data.module;
        setModules((prev) => [...prev, created]);
        setOpenMap((prev) => ({ ...prev, [created.id]: true }));
        // Open the starter section so the new module isn't a dead end.
        if (res.data.section?.id) {
          navigate(`/app/modules/${created.id}/sections/${res.data.section.id}`);
          onClose?.();
        } else if (created.sections?.[0]?.id) {
          navigate(`/app/modules/${created.id}/sections/${created.sections[0].id}`);
          onClose?.();
        }
      } else {
        const res = await api.post(`/modules/${nameDialog.moduleId}/sections`, { name });
        setModules((prev) =>
          prev.map((m) => (m.id === nameDialog.moduleId ? res.data.module : m))
        );
        setOpenMap((prev) => ({ ...prev, [nameDialog.moduleId]: true }));
        if (res.data.section?.id) {
          navigate(`/app/modules/${nameDialog.moduleId}/sections/${res.data.section.id}`);
          onClose?.();
        }
      }
      setNameDialog(null);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not save');
    } finally {
      setSubmitting(false);
    }
  }

  function openDeleteModule(moduleId, e) {
    e.stopPropagation();
    setConfirmDialog({
      type: 'module',
      moduleId,
      title: 'Delete module',
      message: 'Delete this module and its custom sections? This cannot be undone.',
    });
  }

  function openDeleteSection(moduleId, sectionId, e) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDialog({
      type: 'section',
      moduleId,
      sectionId,
      title: 'Delete section',
      message: 'Delete this section? This cannot be undone.',
    });
  }

  async function confirmDelete() {
    if (!confirmDialog) return;
    setSubmitting(true);
    setNotice('');
    try {
      if (confirmDialog.type === 'module') {
        await api.delete(`/modules/${confirmDialog.moduleId}`);
        setModules((prev) => prev.filter((m) => m.id !== confirmDialog.moduleId));
      } else {
        const res = await api.delete(
          `/modules/${confirmDialog.moduleId}/sections/${confirmDialog.sectionId}`
        );
        setModules((prev) =>
          prev.map((m) => (m.id === confirmDialog.moduleId ? res.data.module : m))
        );
      }
      setConfirmDialog(null);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not delete');
    } finally {
      setSubmitting(false);
    }
  }

  function sectionTo(moduleId, section) {
    if (section.path) return section.path;
    return `/app/modules/${moduleId}/sections/${section.id}`;
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col text-slate-200 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: BRAND_COLOR.sidebar }}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-4 py-4">
          <BrandMark className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold text-white">{BRAND_NAME}</div>
            {user?.tenant?.name || user?.instituteName ? (
              <div
                className="truncate text-[11px]"
                style={{ color: BRAND_COLOR.sidebarMuted }}
                title={user?.tenant?.name || user?.instituteName}
              >
                {user?.tenant?.name || user?.instituteName}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded p-1 text-white/70 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: BRAND_COLOR.sidebarMuted }}
          >
            Modules
          </span>
          <button
            type="button"
            onClick={openAddModule}
            title="Add module"
            className="flex h-6 w-6 items-center justify-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <PlusIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 pb-4 pt-1">
          {loading && <p className="px-2 text-xs" style={{ color: BRAND_COLOR.sidebarMuted }}>Loading...</p>}
          {error && <p className="px-2 text-xs text-red-300">{error}</p>}

          <div className="flex flex-col gap-3">
            {modules.map((mod) => {
              const isOpen = openMap[mod.id] !== false;
              return (
                <div key={mod.id}>
                  <div
                    className="group flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-white/[0.04]"
                    onClick={() => toggleModule(mod.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleModule(mod.id);
                      }
                    }}
                  >
                    <ChevronIcon open={isOpen} className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    <FolderIcon className="h-3.5 w-3.5 shrink-0 text-brand-300" />
                    <span
                      className="min-w-0 flex-1 truncate text-[12px] font-semibold uppercase tracking-wide"
                      style={{ color: BRAND_COLOR.sidebarMuted }}
                    >
                      {mod.name}
                    </span>
                    <button
                      type="button"
                      title="Add section"
                      onClick={(e) => openAddSection(mod.id, e)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/50 opacity-70 transition hover:bg-white/10 hover:text-white hover:opacity-100"
                    >
                      <PlusIcon className="h-3 w-3" />
                    </button>
                    {!mod.isSystem && (
                      <button
                        type="button"
                        title="Delete module"
                        onClick={(e) => openDeleteModule(mod.id, e)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-red-300/70 opacity-70 transition hover:bg-red-500/15 hover:text-red-200 hover:opacity-100"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {mod.sections.length === 0 ? (
                        <button
                          type="button"
                          onClick={(e) => openAddSection(mod.id, e)}
                          className="mx-2 mb-1 flex w-[calc(100%-1rem)] items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 px-3 py-2.5 text-[12px] font-medium text-white/70 transition hover:border-white/40 hover:bg-white/[0.06] hover:text-white"
                        >
                          <PlusIcon className="h-3 w-3" />
                          Add first section
                        </button>
                      ) : (
                        mod.sections.map((section) => {
                          const { color, Icon } = sectionVisual(section, BRAND_COLOR[300]);
                          return (
                            <div
                              key={section.id}
                              className="group/sec relative flex items-center"
                            >
                              <NavLink
                                to={sectionTo(mod.id, section)}
                                end={section.path === '/app'}
                                onClick={onClose}
                                className={({ isActive }) =>
                                  `flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition ${
                                    isActive
                                      ? 'font-semibold text-white'
                                      : 'font-medium hover:bg-white/[0.06] hover:text-white'
                                  }`
                                }
                                style={({ isActive }) => ({
                                  backgroundColor: isActive ? BRAND_COLOR.sidebarActive : undefined,
                                  color: isActive ? '#fff' : BRAND_COLOR.sidebarText,
                                })}
                              >
                                <span className="shrink-0" style={{ color }}>
                                  <Icon className="h-[18px] w-[18px]" />
                                </span>
                                <span className="truncate">{section.name}</span>
                              </NavLink>
                              {!section.path && !section.linkedModuleId && (
                                <button
                                  type="button"
                                  title="Delete section"
                                  onClick={(e) => openDeleteSection(mod.id, section.id, e)}
                                  className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-red-300 opacity-0 transition group-hover/sec:opacity-100 hover:bg-red-500/20"
                                >
                                  <TrashIcon className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/[0.08] px-3 py-3">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              openCustomize();
            }}
            className="mb-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.05]"
            title="Customize theme"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: BRAND_COLOR.sidebarActive }}
            >
              {(user?.name || 'U').slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium" style={{ color: BRAND_COLOR.sidebarText }}>
                {user?.name}
                {user?.membershipRole ? ` · ${user.membershipRole}` : ''}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: BRAND_COLOR.sidebarMuted }}>
                <PaletteIcon />
                Customize theme
              </span>
            </span>
          </button>
          {user?.isSuperAdmin && (
            <NavLink
              to="/app/admin"
              onClick={onClose}
              className="mb-1.5 block rounded-xl px-3 py-2 text-sm text-brand-200 hover:bg-white/[0.05]"
            >
              Super Admin
            </NavLink>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/[0.05] hover:text-white"
            style={{ color: BRAND_COLOR.sidebarMuted }}
          >
            Log out
          </button>
        </div>
      </aside>

      <Modal
        open={Boolean(nameDialog)}
        title={nameDialog?.title}
        onClose={() => {
          if (!submitting) {
            setNameDialog(null);
            setNotice('');
          }
        }}
        footer={
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setNameDialog(null);
                setNotice('');
              }}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sidebar-name-form"
              disabled={submitting}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form id="sidebar-name-form" onSubmit={submitNameDialog}>
          <label className="mb-1 block text-xs font-medium text-slate-600">{nameDialog?.label}</label>
          <input
            value={nameDialog?.value || ''}
            onChange={(e) => setNameDialog((d) => ({ ...d, value: e.target.value }))}
            placeholder={nameDialog?.mode === 'module' ? 'e.g. Support' : 'e.g. Tickets'}
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
          {notice && nameDialog ? (
            <p className="mt-2 text-xs text-[#d03b3b]">{notice}</p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        onClose={() => {
          if (!submitting) {
            setConfirmDialog(null);
            setNotice('');
          }
        }}
        footer={
          <>
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setConfirmDialog(null);
                setNotice('');
              }}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={confirmDelete}
              className="rounded-md bg-[#d03b3b] px-4 py-2 text-sm font-medium text-white hover:bg-[#b83333] disabled:opacity-60"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{confirmDialog?.message}</p>
        {notice && confirmDialog ? <p className="mt-2 text-xs text-[#d03b3b]">{notice}</p> : null}
      </Modal>
    </>
  );
}
