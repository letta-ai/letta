import {
  Button,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-web/component-library';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('NotFoundPage');
  return (
    <div className="w-screen h-screen">
      <VStack fullHeight fullWidth align="center" justify="center">
        <LoadingEmptyStatusComponent
          emptyMessage={t('emptyMessage')}
          emptyAction={<Button label={t('emptyAction')} href="/" />}
        />
      </VStack>
    </div>
  );
}
