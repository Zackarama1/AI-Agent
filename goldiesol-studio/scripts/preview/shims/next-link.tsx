import { forwardRef } from 'react';
import { router } from '../router';

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, onClick, ...rest }, ref) {
  const external = /^https?:/.test(href);
  return (
    <a
      ref={ref}
      href={external ? href : `#${href}`}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (external || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        router.navigate(href);
      }}
    />
  );
});

export default Link;
