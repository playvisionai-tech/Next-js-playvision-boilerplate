import { NextIntlClientProvider } from 'next-intl';
import { useLayoutEffect, useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import messages from '@/messages/en.json';
import { LocaleSwitcher } from '../locale-switcher';

const push =
  vi.fn<
    (href: string | { pathname: string }, options?: { locale?: string; scroll?: boolean }) => void
  >();
const noop = () => {};

vi.mock(import('@/lib/i18n/navigation'), () => ({
  useRouter: () => ({
    push,
    replace: noop,
    prefetch: noop,
    back: noop,
    forward: noop,
    refresh: noop,
  }),
  usePathname: () => '/about',
}));

// The switcher carries the current query string across the switch, and the
// vitest browser runner serves the test from an iframe that has one of its own.
const expectedHref = () => `/about${window.location.search}`;

/**
 * Renders the switcher with a locale already selected in the DOM before the
 * switcher's own mount effect can read it.
 *
 * This is the shape a pre-hydration choice leaves behind: the value is set,
 * and no `change` event is dispatched because in the real case there was
 * nobody listening for it. Layout effects run before any passive effect
 * anywhere in the tree, so this always lands first.
 *
 * @param props Component props.
 * @param props.selected The locale sitting in the select when React arrives.
 * @returns The switcher, wrapped.
 */
const ChosenBeforeMount = (props: { selected: string }) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const select = ref.current?.querySelector('select');

    if (select) {
      select.value = props.selected;
    }
  }, [props.selected]);

  return (
    <div ref={ref}>
      <LocaleSwitcher />
    </div>
  );
};

const renderSwitcher = async (children: React.ReactNode) =>
  await render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>,
  );

describe('Locale switcher', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('navigates when a locale is chosen', async () => {
    await renderSwitcher(<LocaleSwitcher />);

    await page.getByLabelText('Change language').selectOptions('fr');

    expect(push).toHaveBeenCalledWith(expectedHref(), { locale: 'fr', scroll: false });
  });

  it('honours a locale already selected when it mounts', async () => {
    await renderSwitcher(<ChosenBeforeMount selected="fr" />);

    expect(push).toHaveBeenCalledWith(expectedHref(), { locale: 'fr', scroll: false });
  });

  it('stays put when the selected locale is the active one', async () => {
    await renderSwitcher(<ChosenBeforeMount selected="en" />);

    expect(push).not.toHaveBeenCalled();
  });
});
