import React, { useEffect, useState } from 'react';
import { api, StoreInfo } from '../api/client';

type StoreWithDistance = StoreInfo & { distance_km?: number };

export const StoreListView = () => {
  const [stores, setStores] = useState<StoreWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getNearbyStores()
      .then(data => setStores(data.stores))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-center">Ищем магазины рядом... 📍</div>;
  if (error) return <div className="p-4 text-center text-red-500">Ошибка: {error}</div>;

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Магазины рядом</h1>
      {stores.length === 0 ? (
        <p className="text-gray-500">В вашем радиусе пока нет активных магазинов.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {stores.map(store => (
            <a 
              key={store.id} 
              href={`/?store_id=${store.id}`} 
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center active:scale-95 transition-transform"
            >
              <div>
                <h2 className="font-semibold text-lg">{store.name}</h2>
                <p className="text-sm text-gray-500">{store.address}</p>
              </div>
              {store.distance_km !== undefined && store.distance_km !== null && (
                <div className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
                  {store.distance_km.toFixed(1)} км
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};