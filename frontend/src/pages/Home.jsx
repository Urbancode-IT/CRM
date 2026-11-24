import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postAuthPath } from '../utils/postAuthPath';
import BrandMark from '../components/BrandMark';
import { BRAND_NAME, BRAND_TAGLINE } from '../constants/brand';

const BLUE = {
  400: '#5c8bff',
  500: '#3766f5',
  600: '#2549d1',
  700: '#1e3aa8',
  800: '#1c3286',
  900: '#1b2c6b',
  bg: '#0b1c2e',
};

export default function Home() {
  const { user, loading } = useAuth();
  const loggedIn = !loading && user;
  const appTo = loggedIn ? postAuthPath(user) : '/login';

  return (
    <div className="min-h-screen overflow-x-hidden text-white" style={{ backgroundColor: BLUE.bg }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-[70vh] w-[70vw] bg-[radial-gradient(circle_at_center,rgba(55,102,245,0.35),transparent_65%)]" />
        <div className="absolute bottom-0 right-0 h-[50vh] w-[50vw] bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.2),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-8 w-8" color={BLUE[600]} />
          <span className="font-display text-lg font-semibold tracking-tight">{BRAND_NAME}</span>
        </div>
        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Link
              to={appTo}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              style={{ backgroundColor: BLUE[500] }}
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:text-white">
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                style={{ backgroundColor: BLUE[500] }}
              >
                Start free trial
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-6xl flex-col justify-center px-6 pb-16 pt-8">
        <div className="max-w-2xl">
          <p className="font-display animate-fade-up text-5xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl">
            {BRAND_NAME}
          </p>
          <h1 className="animate-fade-up-delay mt-5 max-w-xl text-2xl font-medium leading-snug text-slate-100 sm:text-3xl">
            Run your tuition class without the chaos.
          </h1>
          <p className="animate-fade-up-delay-2 mt-4 max-w-md text-base leading-relaxed text-slate-300">
            {BRAND_TAGLINE}. Track students, attendance, fees, and tasks in one workspace.
          </p>
          <div className="animate-fade-up-delay-2 mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={loggedIn ? appTo : '/register'}
              className="rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/40 hover:opacity-95"
              style={{ backgroundColor: BLUE[500] }}
            >
              {loggedIn ? 'Open dashboard' : 'Start free trial'}
            </Link>
            {!loggedIn && (
              <Link
                to="/login"
                className="rounded-md border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/10"
              >
                Login
              </Link>
            )}
            <a
              href="#how"
              className="rounded-md px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white"
            >
              How it works
            </a>
          </div>
        </div>

        <div className="pointer-events-none absolute right-6 top-1/2 hidden w-[38%] -translate-y-1/2 lg:block">
          <div
            className="animate-float relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40"
            style={{
              background: `linear-gradient(to bottom right, ${BLUE[700]}, ${BLUE[500]}, #0ea5e9)`,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_55%)]" />
            <div
              className="absolute bottom-0 left-0 right-0 h-1/2"
              style={{
                background: `linear-gradient(to top, ${BLUE.bg}, transparent)`,
              }}
            />
            <div className="absolute inset-x-6 bottom-8 space-y-3">
              <div className="h-2 w-2/3 rounded-full bg-white/25" />
              <div className="h-2 w-1/2 rounded-full bg-white/15" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
                  <div className="text-[10px] uppercase tracking-wide text-slate-300">Collected</div>
                  <div className="mt-1 font-display text-lg text-white">₹72k</div>
                </div>
                <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
                  <div className="text-[10px] uppercase tracking-wide text-slate-300">Pending</div>
                  <div className="mt-1 font-display text-lg text-white">₹28k</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <section
        id="how"
        className="relative z-10 border-t border-white/10 py-16 backdrop-blur"
        style={{ backgroundColor: 'rgba(11, 28, 46, 0.85)' }}
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-3">
          {[
            {
              title: 'Manage students',
              body: 'Keep class batches, contacts, and parent details organised.',
            },
            {
              title: 'Track fees',
              body: 'See monthly fee collected, pending, and overdue at a glance.',
            },
            {
              title: 'Mark attendance',
              body: 'Record daily presence and follow up on absences quickly.',
            },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="font-display text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: BLUE[400] }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
