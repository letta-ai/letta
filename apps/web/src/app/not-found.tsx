import {
  Button,
  LoadingEmptyStatusComponent,
  VStack,
} from '@letta-cloud/ui-component-library';
import { useTranslations } from '@letta-cloud/translations';

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
