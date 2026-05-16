import { Card, CardContent } from '@/components/ui/card';
import { DashboardShell } from '@/components/DashboardShell';

export default function VendorOverview() {
  return (
    <DashboardShell role="vendor" title="Overview">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Vendor dashboard</h2>
          <p className="text-gray-600 text-sm">
            This is the vendor dashboard shell. Next we’ll wire listings, customers, verification, orders, and earnings.
          </p>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
