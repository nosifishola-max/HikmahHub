import { Card, CardContent } from '@/components/ui/card';
import { DashboardShell } from '@/components/DashboardShell';

export default function CustomerOrders() {
  return (
    <DashboardShell role="customer" title="Orders">
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Order tracking</h2>
          <p className="text-gray-600 text-sm">
            Orders are not fully implemented in this project yet. We’ll connect order history and tracking once the backend table is ready.
          </p>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
