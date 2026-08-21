import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Suspense } from 'react';
import arcjetLogo from '@/public/assets/images/arcjet-light.svg';
import { CounterForm } from './components/counter-form';
import { CounterSkeleton } from './components/counter-skeleton';
import { CurrentCount } from './components/current-count';

export const CounterView = () => {
  const t = useTranslations('Counter');

  return (
    <>
      <CounterForm />

      <div className="mt-3">
        <Suspense fallback={<CounterSkeleton />}>
          <CurrentCount />
        </Suspense>
      </div>

      <div className="mt-5 text-center text-sm">
        {`${t('security_powered_by')} `}
        <a
          className="text-blue-700 hover:border-b-2 hover:border-blue-700"
          href="https://launch.arcjet.com/Q6eLbRE"
        >
          Arcjet
        </a>
      </div>

      <a href="https://launch.arcjet.com/Q6eLbRE">
        <Image className="mx-auto mt-2" src={arcjetLogo} alt="Arcjet" width={130} />
      </a>
    </>
  );
};
