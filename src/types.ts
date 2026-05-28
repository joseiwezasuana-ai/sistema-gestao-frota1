export interface Passenger {
  id: string;
  name: string;
  age: number;
  province: string;
  photoUrl?: string;
  createdAt: Date;
}

export interface RideRequest {
  id: string;
  passengerId: string;
  pickup: string;
  destination: string;
  vehicleSelection: string;
  price: number | null;
  status: 'pending' | 'price_sent' | 'confirmed' | 'cancelled' | 'completed';
  driverId: string | null;
  createdAt: Date;
}
