export interface Listing {
  id: number;
  address: string;
  cityStateZip: string;
  neighborhood?: string;
  price?: string;
  style?: string;
  yearBuilt?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
  lotSqft?: string;
  garage?: string;
  taxes?: string;
  estimatedPayment?: string;
  agentName?: string;
  description?: string;
  features?: string;
  location?: string;
}