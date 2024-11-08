'use client';
import {
  Card,
  DashboardPageLayout,
  DashboardPageSection,
  HStack,
  NiceGridDisplay,
  Typography,
  VStack,
} from '@letta-web/component-library';
import { NavigationItems } from './constants';
import Link from 'next/link';

function AdminHomepage() {
  return (
    <DashboardPageLayout title="Admin homepage">
      <DashboardPageSection>
        <NiceGridDisplay>
          {NavigationItems.map((item) => (
            <Link href={item.href} key={item.id}>
              <Card
                /* eslint-disable-next-line react/forbid-component-props */
                className="h-full flex hover:bg-tertiary-hover"
                key={item.id}
              >
                <VStack justify="start" align="start">
                  <HStack align="center">
                    {item.icon}
                    <Typography>{item.label}</Typography>
                  </HStack>
                  <Typography italic>{item.description}</Typography>
                </VStack>
              </Card>
            </Link>
          ))}
        </NiceGridDisplay>
      </DashboardPageSection>
    </DashboardPageLayout>
  );
}

export default AdminHomepage;
