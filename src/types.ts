export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    role: 'driver' | 'employer' | 'admin';
    avatar_url?: string;
    created_at: string;
}

export interface Load {
    id: number;
    employer_id: string;
    origin_city: string;
    destination_city: string;
    distance_km?: number;
    load_type: string;
    trailer_type: 'Kapalı' | 'Açık' | 'Frigorifik' | 'Damperli';
    weight_kg?: number;
    price: number;
    currency: string;
    status: 'open' | 'assigned' | 'completed' | 'cancelled';
    pickup_date: string;
    created_at: string;
    is_urgent: boolean;
    is_fleet: boolean;
    truck_count: number;
}

export interface Offer {
    id: number;
    load_id: number;
    driver_id: string;
    price: number;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}
