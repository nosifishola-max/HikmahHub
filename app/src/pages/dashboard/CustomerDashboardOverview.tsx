import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DashboardShell } from '@/components/DashboardShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Layout } from '@/components/Layout';
import { useListings } from '@/hooks';
import type { ListingWithUser } from '@/hooks/useListings';

export default function CustomerDashboardOverview() {
  const { fetchListings } = useListings();
  const [featured, setFeatured] = useState<ListingWithUser[]>([]);

  useEffect(() => {
    fetchListings({ boosted: true as any }).then((result: any) => {
      const data = result?.data ?? [];
      setFeatured(data.slice(0, 6));
    });
  }, [fetchListings]);

  return (
    <DashboardShell role="customer" title="Overview">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Welcome back</h1>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Featured for you</p>
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              {featured.length === 0 ? (
                <div className="text-gray-500 text-sm">No listings yet.</div>
              ) : (
                featured.map((l) => (
                  <Link key={l.id} to={`/listing/${l.id}`} className="block">
                    <div className="rounded-xl border border-gray-200 p-3 hover:bg-gray-50 transition-colors">
                      <div className="text-sm font-semibold text-gray-900 truncate">{l.title}</div>
                      <div className="text-emerald-700 font-bold mt-1">₦{Number(l.price).toLocaleString()}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500">Quick actions</p>
            <div className="mt-4 space-y-2">
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                <Link to="/marketplace">
                  Browse Marketplace <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/create-listing">Create Listing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-gray-500">Need help?</p>
          <p className="mt-2 text-gray-700 text-sm">
            Check the <Link to="/team" className="text-emerald-700 font-semibold underline">Our Team</Link> section.
          </p>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
