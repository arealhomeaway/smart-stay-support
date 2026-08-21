/** Shared, client-safe map types. */
export type MapJob = {
  id: string;
  ref: number;
  title: string;
  priority: string;
  status: string;
  dueAt: string | null;
  vendorName: string | null;
  vendorStatus: string | null;
};

export type MapPin = {
  propertyId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  openJobs: MapJob[];
};
