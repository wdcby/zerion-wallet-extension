import React, { useMemo } from 'react';
import { AreaProvider } from 'react-area';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from 'react-router-dom';
import dayjs from 'dayjs';
import * as styles from 'src/ui/style/global.module.css';
import relativeTime from 'dayjs/plugin/relativeTime';
import { GetStarted } from 'src/ui/pages/GetStarted';
import { Intro } from 'src/ui/pages/Intro';
import { Overview } from 'src/ui/pages/Overview';
import { RouteResolver } from 'src/ui/pages/RouteResolver';
import { RequestAccounts } from 'src/ui/pages/RequestAccounts';
import { SendTransaction } from 'src/ui/pages/SendTransaction';
import { SignMessage } from 'src/ui/pages/SignMessage';
import { SignTypedData } from 'src/ui/pages/SignTypedData';
import { useStore } from '@store-unit/react';
import { runtimeStore } from 'src/shared/core/runtime-store';
import { Login } from '../pages/Login';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { accountPublicRPCPort, walletPort } from '../shared/channels';
import { CreateAccount } from '../pages/CreateAccount';
import {
  isFullScreenMode,
  pageTemplateType,
} from '../shared/getPageTemplateName';
import { URLBar } from '../components/URLBar';
import { SwitchEthereumChain } from '../pages/SwitchEthereumChain';
import { DesignTheme } from '../components/DesignTheme';
import { FillView } from '../components/FillView';
import { ViewError } from '../components/ViewError';
import { ViewArea } from '../components/ViewArea';
import { Settings } from '../pages/Settings';
import { Networks } from '../pages/Networks';
import { BackupWallet } from '../pages/BackupWallet';
import { ManageWallets } from '../pages/ManageWallets';
import { WalletSelect } from '../pages/WalletSelect';
import { NotFoundPage } from '../components/NotFoundPage';
import { UIText } from '../ui-kit/UIText';
import { defaultUIContextValue, UIContext } from '../components/UIContext';
import { ConnectedSites } from '../pages/ConnectedSites';
import { InactivityDetector } from '../components/Session/InactivityDetector';
import { SessionResetHandler } from '../components/Session/SessionResetHandler';
import { ViewSuspense } from '../components/ViewSuspense';
import { VersionUpgrade } from '../components/VersionUpgrade';
import { queryClient } from '../shared/requests/queryClient';
import { ForgotPassword } from '../pages/ForgotPassword';
import { AbilityPage } from '../pages/Feed/Ability';
import { FooterBugReportButton } from '../components/BugReportButton';
import { Receive } from '../pages/Receive';
import { KeyboardShortcut } from '../components/KeyboardShortcut';
import { initialize as initializeApperance } from '../features/appearance';
import { HandshakeFailure } from '../components/HandshakeFailure';
import { useScreenViewChange } from '../shared/useScreenViewChange';
import { NonFungibleToken } from '../pages/NonFungibleToken';
import { Onboarding } from '../Onboarding';
import { AddEthereumChain } from '../pages/AddEthereumChain';
import { SignInWithEthereum } from '../pages/SignInWithEthereum';
import { useBodyStyle } from '../components/Background/Background';
import { PhishingWarningPage } from '../components/PhishingDefence/PhishingWarningPage';
import { HardwareWalletConnection } from '../pages/HardwareWalletConnection';
import { ThemeDecoration } from '../components/DesignTheme/ThemeDecoration';
import { SendForm } from '../pages/SendForm';
import { SwapForm } from '../pages/SwapForm';
import { MintDnaFlow } from '../DNA/pages/MintDnaFlow';
import { UpgradeDnaFlow } from '../DNA/pages/UpgradeDnaFlow';
import { RouteRestoration, registerPersistentRoute } from './RouteRestoration';

const isProd = process.env.NODE_ENV === 'production';

const useAuthState = () => {
  const { data, isFetching } = useQuery({
    queryKey: ['authState'],
    queryFn: async () => {
      const [isAuthenticated, existingUser, wallet] = await Promise.all([
        accountPublicRPCPort.request('isAuthenticated'),
        accountPublicRPCPort.request('getExistingUser'),
        walletPort.request('uiGetCurrentWallet'),
      ]);
      return {
        isAuthenticated,
        existingUser,
        wallet,
      };
    },
    useErrorBoundary: true,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { isAuthenticated, existingUser, wallet } = data || {};
  // const { data: isAuthenticated, ...isAuthenticatedQuery } = useQuery(
  //   'isAuthenticated',
  //   () => accountPublicRPCPort.request('isAuthenticated'),
  //   { useErrorBoundary: true, retry: false }
  // );
  // const { data: existingUser, ...getExistingUserQuery } = useQuery(
  //   'getExistingUser',
  //   () => accountPublicRPCPort.request('getExistingUser'),
  //   { useErrorBoundary: true, retry: false }
  // );
  // const { data: wallet, ...currentWalletQuery } = useQuery(
  //   'wallet/getCurrentWallet',
  //   () => walletPort.request('getCurrentWallet'),
  //   { useErrorBoundary: true, retry: false }
  // );
  // const isLoading =
  //   isAuthenticatedQuery.isFetching ||
  //   getExistingUserQuery.isFetching ||
  //   currentWalletQuery.isLoading;
  return {
    isAuthenticated: Boolean(isAuthenticated && wallet),
    existingUser,
    isLoading: isFetching,
  };
};

function SomeKindOfResolver({
  noUser,
  notAuthenticated,
  authenticated,
}: {
  noUser: JSX.Element;
  notAuthenticated: JSX.Element;
  authenticated: JSX.Element;
}) {
  const { isLoading, isAuthenticated, existingUser } = useAuthState();
  if (isLoading) {
    return null;
  }
  if (!existingUser) {
    return noUser;
  }
  if (!isAuthenticated) {
    return notAuthenticated;
  }
  return authenticated;
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const { isLoading, isAuthenticated, existingUser } = useAuthState();

  if (isLoading) {
    return null;
  }

  if (!existingUser) {
    return <Navigate to="/" replace={true} />;
  } else if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(
          `${location.pathname}${location.search}`
        )}`}
        replace={true}
      />
    );
  }

  return children;
}

function FullScreenViews() {
  return (
    <Routes>
      <Route path="/mint-dna/*" element={<MintDnaFlow />} />
      <Route path="/upgrade-dna/*" element={<UpgradeDnaFlow />} />
    </Routes>
  );
}

function Views({ initialRoute }: { initialRoute?: string }) {
  useScreenViewChange();
  return (
    <RouteResolver>
      <ViewArea>
        <URLBar />
        {pageTemplateType === 'popup' ? (
          <RouteRestoration initialRoute={initialRoute} />
        ) : null}
        <Routes>
          {initialRoute ? (
            <Route path="/" element={<Navigate to={initialRoute} />} />
          ) : null}
          <Route
            path="/"
            element={
              <SomeKindOfResolver
                noUser={<Navigate to="/intro" replace={true} />}
                notAuthenticated={<Navigate to="/login" replace={true} />}
                authenticated={<Navigate to="/overview" replace={true} />}
              />
            }
          />
          <Route path="/intro" element={<Intro />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/get-started/*" element={<GetStarted />} />
          <Route
            path="/connect-hardware-wallet/*"
            element={<HardwareWalletConnection />}
          />
          <Route path="/receive" element={<Receive />} />
          <Route path="/phishing-warning" element={<PhishingWarningPage />} />
          <Route
            path="/nft/:chain/:asset_code"
            element={
              <RequireAuth>
                <NonFungibleToken />
              </RequireAuth>
            }
          />
          <Route
            path="/overview/*"
            element={
              <RequireAuth>
                <Overview />
              </RequireAuth>
            }
          />
          <Route
            path="/settings/*"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
          <Route
            path="/networks-select"
            element={
              <RequireAuth>
                <Networks />
              </RequireAuth>
            }
          />
          <Route
            path="/networks/*"
            element={
              <RequireAuth>
                <Networks />
              </RequireAuth>
            }
          />
          <Route
            path="/backup-wallet/*"
            element={
              <RequireAuth>
                <BackupWallet />
              </RequireAuth>
            }
          />
          <Route
            path="/requestAccounts"
            element={
              <RequireAuth>
                <RequestAccounts />
              </RequireAuth>
            }
          />
          <Route
            path="/sendTransaction/*"
            element={
              <RequireAuth>
                <SendTransaction />
              </RequireAuth>
            }
          />
          <Route
            path="/siwe/*"
            element={
              <RequireAuth>
                <SignInWithEthereum />
              </RequireAuth>
            }
          />
          <Route
            path="/signMessage"
            element={
              <RequireAuth>
                <SignMessage />
              </RequireAuth>
            }
          />
          <Route
            path="/signTypedData"
            element={
              <RequireAuth>
                <SignTypedData />
              </RequireAuth>
            }
          />
          {/* TODO: Should this page be removed? */}
          <Route
            path="/switchEthereumChain"
            element={
              <RequireAuth>
                <SwitchEthereumChain />
              </RequireAuth>
            }
          />
          <Route
            path="/addEthereumChain/*"
            element={
              <RequireAuth>
                <AddEthereumChain />
              </RequireAuth>
            }
          />
          <Route
            path="/wallets/*"
            element={
              <RequireAuth>
                <ManageWallets />
              </RequireAuth>
            }
          />
          <Route
            path="/wallet-select"
            element={
              <RequireAuth>
                <WalletSelect />
              </RequireAuth>
            }
          />
          <Route
            path="/connected-sites/*"
            element={
              <RequireAuth>
                <ConnectedSites />
              </RequireAuth>
            }
          />
          <Route path="/handshake-failure" element={<HandshakeFailure />} />
          <Route
            path="/ability/:ability_uid"
            element={
              <RequireAuth>
                <AbilityPage />
              </RequireAuth>
            }
          />
          <Route
            path="/send-form/*"
            element={
              <RequireAuth>
                <SendForm />
              </RequireAuth>
            }
          />
          <Route
            path="/swap-form/*"
            element={
              <RequireAuth>
                <SwapForm />
              </RequireAuth>
            }
          />
          <Route
            path="/not-implemented"
            element={
              <FillView>
                <UIText
                  kind="body/regular"
                  color="var(--neutral-500)"
                  style={{ padding: 20, textAlign: 'center' }}
                >
                  This View is not Implemented
                </UIText>
              </FillView>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ViewArea>
    </RouteResolver>
  );
}

initializeApperance();
dayjs.extend(relativeTime);
registerPersistentRoute('/send-form');
registerPersistentRoute('/swap-form');

export interface AppProps {
  mode: 'onboarding' | 'wallet';
  initialView?: 'handshakeFailure';
  inspect?: { message: string };
}

export function App({ initialView, mode, inspect }: AppProps) {
  const bodyClassList = useMemo(() => {
    const result = [];
    if (pageTemplateType === 'dialog') {
      result.push(styles.isDialog);
    } else if (pageTemplateType === 'tab') {
      result.push(styles.isTab);
    }
    if (mode === 'onboarding' || isFullScreenMode) {
      result.push(styles.fullScreen);
    }
    return result;
  }, [mode]);

  const { connected } = useStore(runtimeStore);

  useBodyStyle(
    useMemo(() => ({ opacity: connected ? '' : '0.6' }), [connected])
  );

  return (
    <AreaProvider>
      <UIContext.Provider value={defaultUIContextValue}>
        <QueryClientProvider client={queryClient}>
          <DesignTheme bodyClassList={bodyClassList} />
          <Router>
            <ErrorBoundary renderError={(error) => <ViewError error={error} />}>
              <InactivityDetector />
              <SessionResetHandler />
              <ThemeDecoration />
              {inspect && !isProd ? (
                <UIText
                  kind="small/regular"
                  style={{
                    borderBottom: '1px solid var(--neutral-300)',
                    paddingInline: 12,
                  }}
                >
                  {inspect.message}
                </UIText>
              ) : null}
              <KeyboardShortcut
                combination="ctrl+alt+0"
                onKeyDown={() => {
                  // Helper for development and debugging :)
                  const url = new URL(window.location.href);
                  url.searchParams.set('templateType', 'tab');
                  window.open(url, '_blank');
                }}
              />
              <VersionUpgrade>
                <ViewSuspense logDelays={true}>
                  {mode === 'onboarding' &&
                  initialView !== 'handshakeFailure' ? (
                    <Onboarding />
                  ) : isFullScreenMode ? (
                    <FullScreenViews />
                  ) : (
                    <Views
                      initialRoute={
                        initialView === 'handshakeFailure'
                          ? '/handshake-failure'
                          : undefined
                      }
                    />
                  )}
                </ViewSuspense>
              </VersionUpgrade>
            </ErrorBoundary>
            <FooterBugReportButton />
          </Router>
        </QueryClientProvider>
      </UIContext.Provider>
    </AreaProvider>
  );
}
