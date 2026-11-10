import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './state/AppContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ChatBubble from './components/ChatBubble.jsx';
import { BottomNav, OfflineBanner, Toast } from './components/UI.jsx';
import Splash from './pages/Splash.jsx';
import Welcome from './pages/Welcome.jsx';
import Language from './pages/Language.jsx';
import Login from './pages/Login.jsx';
import Otp from './pages/Otp.jsx';
import SignIn from './pages/SignIn.jsx';
import Home from './pages/Home.jsx';
import Water from './pages/Water.jsx';
import Report from './pages/Report.jsx';
import Forecast from './pages/Forecast.jsx';
import Alerts from './pages/Alerts.jsx';
import News from './pages/News.jsx';
import Fields from './pages/Fields.jsx';
import Profile from './pages/Profile.jsx';
import RegIdentity from './pages/register/RegIdentity.jsx';
import RegCrops from './pages/register/RegCrops.jsx';
import RegPin from './pages/register/RegPin.jsx';
import RegWater from './pages/register/RegWater.jsx';
import RegField from './pages/register/RegField.jsx';
import RegFlood from './pages/register/RegFlood.jsx';
import RegReview from './pages/register/RegReview.jsx';
import RegDone from './pages/register/RegDone.jsx';
import NotFound from './pages/NotFound.jsx';
import { useAndroidBack } from './useAndroidBack.js';
import ErrorScreen from './pages/ErrorScreen.jsx';

function RequireAuth({ children }) {
  const { user } = useApp();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

// Farm registration is required: signed-in farmers without a farm are sent to the registration flow.
function RequireFarm({ children }) {
  const { farm } = useApp();
  if (!farm) return <Navigate to="/register/identity" replace />;
  return children;
}

const farmOnly = (page) => <RequireAuth><RequireFarm>{page}</RequireFarm></RequireAuth>;

const NAV_ROUTES = ['/home', '/water', '/report', '/fields', '/profile', '/alerts', '/forecast', '/news'];

export default function App() {
  const { pathname } = useLocation();
  const showNav = NAV_ROUTES.includes(pathname);
  const { lang, user, farm } = useApp();
  // The assistant is for signed-in farmers only, on the main pages (where it sits above the
  // bottom bar, clear of each step's Continue button). It is outside the per-page error boundary,
  // so changing page doesn't wipe the conversation; signing out unmounts it and clears it.
  const signedIn = Boolean(user?.farmerId && farm);
  const showChat = signedIn && showNav;
  useAndroidBack(signedIn);

  return (
    <div className="stage">
      <div className={`device lang-${lang}`} data-theme="light">
        <OfflineBanner />
        <ErrorBoundary key={pathname}>
          <main className={`viewport ${showNav ? 'has-nav' : ''} ${showChat ? 'has-chat' : ''}`} key={pathname}>
            <Routes>
              <Route path="/" element={<Splash />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/language" element={<Language />} />
              <Route path="/login" element={<Login />} />
              <Route path="/otp" element={<Otp />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/home" element={farmOnly(<Home />)} />
              <Route path="/water" element={farmOnly(<Water />)} />
              <Route path="/report" element={farmOnly(<Report />)} />
              <Route path="/forecast" element={farmOnly(<Forecast />)} />
              <Route path="/alerts" element={farmOnly(<Alerts />)} />

              <Route path="/news" element={farmOnly(<News />)} />
              <Route path="/fields" element={farmOnly(<Fields />)} />
              <Route path="/profile" element={farmOnly(<Profile />)} />
              <Route path="/register" element={<Navigate to="/register/identity" replace />} />
              <Route path="/register/identity" element={<RequireAuth><RegIdentity /></RequireAuth>} />
              <Route path="/register/crops" element={<RequireAuth><RegCrops /></RequireAuth>} />
              <Route path="/register/pin" element={<RequireAuth><RegPin /></RequireAuth>} />
              <Route path="/register/field" element={<RequireAuth><RegField /></RequireAuth>} />
              <Route path="/register/water" element={<RequireAuth><RegWater /></RequireAuth>} />
              <Route path="/register/flood" element={<RequireAuth><RegFlood /></RequireAuth>} />
              <Route path="/register/review" element={<RequireAuth><RegReview /></RequireAuth>} />
              <Route path="/register/done" element={<RequireAuth><RegDone /></RequireAuth>} />
              <Route path="/error" element={<ErrorScreen />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </ErrorBoundary>
        {/* stays mounted on the other pages (e.g. editing the farm), just hidden, so the chat is still there on return */}
        {signedIn && <ErrorBoundary fallback={null}><ChatBubble hidden={!showChat} /></ErrorBoundary>}
        {showNav && <BottomNav />}
        <Toast />
      </div>
    </div>
  );
}
