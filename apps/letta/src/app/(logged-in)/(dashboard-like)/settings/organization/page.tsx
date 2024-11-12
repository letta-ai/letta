import { redirect } from 'next/navigation';

function OrganizationsPage() {
  redirect('/settings/organization/general');
}

export default OrganizationsPage;
