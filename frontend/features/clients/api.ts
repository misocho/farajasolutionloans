import api from "@/app/lib/api";

export interface NextOfKin {
  fullName: string;
  idNo?: string;
  relationship: string;
  phone: string;
  address?: string;
}

export interface PropertyItem {
  description: string;
  makeModel?: string;
  serialNo?: string;
  estValue: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  id_no?: string;
  pin?: string;
  gender?: string;
  marital_status?: string;
  occupation?: string;
  address?: string;
  period_years?: string;
  accommodation?: string;
  landmark?: string;
  
  // Spouse details
  spouse_name?: string;
  spouse_id?: string;
  spouse_phone?: string;
  spouse_occupation?: string;
  
  // Dependants
  dependants_count?: string;
  dependants_ages?: string;
  school_going_count?: string;
  school_details?: string;
  
  // Next of kin list
  next_of_kin_list: NextOfKin[];
  
  // Business details
  business_name?: string;
  business_type: string;
  business_landmark?: string;
  business_years?: string;
  business_location?: string;
  
  // Guarantor details
  guarantor_surname?: string;
  guarantor_first_name?: string;
  guarantor_middle_name?: string;
  guarantor_phone?: string;
  guarantor_relationship?: string;
  guarantor_address?: string;
  guarantor_occupation?: string;
  guarantor_period_known?: string;
  
  // Collateral properties
  properties_list: PropertyItem[];
  
  date_registered: string;
}

export type ClientCreateData = Omit<Client, "id" | "date_registered">;

export async function fetchClientsApi(): Promise<Client[]> {
  const response = await api.get<Client[]>("/clients");
  return response.data;
}

export async function createClientApi(data: ClientCreateData): Promise<Client> {
  const response = await api.post<Client>("/clients", data);
  return response.data;
}
