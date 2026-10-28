// Thin compatibility layer so pages ported from Next.js keep the same API on react-router.
import { forwardRef, useMemo } from 'react';
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
  type LinkProps as RouterLinkProps,
} from 'react-router-dom';

type LinkProps = Omit<RouterLinkProps, 'to'> & { href: string };

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ href, ...props }, ref) => (
  <RouterLink ref={ref} to={href} {...props} />
));
Link.displayName = 'Link';

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (to: string) => navigate(to),
      replace: (to: string) => navigate(to, { replace: true }),
      back: () => navigate(-1),
    }),
    [navigate],
  );
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  return useRouterSearchParams()[0];
}

export function useParams<T extends Record<string, string> = Record<string, string>>() {
  return useRouterParams() as T;
}
