import { Card, CardContent } from '@/components/ui/card';
import { DashboardShell } from '@/components/DashboardShell';

export default function CustomerSavedItems() {
  return (
    <DashboardShell role="customer" title="Saved Items">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Saved Items</h2>
          <p className="text-gray-600 text-sm">
            This feature isn’t wired to a backend favorites table yet. Start by browsing listings and contacting vendors.
          </p>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
