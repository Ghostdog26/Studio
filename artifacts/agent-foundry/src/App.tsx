import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Shell } from '@/components/foundry-ui';
import OverviewPage from '@/pages/overview';
import KnowledgePage from '@/pages/knowledge';
import AgentsPage from '@/pages/agents';
import McpPage from '@/pages/mcp';
import BuilderPage from '@/pages/builder';
import PrototypeBuilderPage from '@/pages/prototype-builder';
import CataloguePage from '@/pages/catalogue';
import RuntimesPage from '@/pages/runtimes';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  const [path] = useLocation();
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Shell path={path}>
        <Switch>
          <Route path="/" component={OverviewPage} />
          <Route path="/knowledge" component={KnowledgePage} />
          <Route path="/agents" component={AgentsPage} />
          <Route path="/builder" component={BuilderPage} />
          <Route path="/prototype/builder" component={PrototypeBuilderPage} />
          <Route path="/mcp" component={McpPage} />
          <Route path="/catalogue" component={CataloguePage} />
          <Route path="/runtimes" component={RuntimesPage} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
