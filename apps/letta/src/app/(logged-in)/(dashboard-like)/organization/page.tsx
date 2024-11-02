import { redirect } from 'next/navigation';

function OrganizationsPage() {
  redirect('/organization/members');
}

export default OrganizationsPage;
