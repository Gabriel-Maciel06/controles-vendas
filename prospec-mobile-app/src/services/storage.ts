import AsyncStorage from '@react-native-async-storage/async-storage';
import { Prospect } from '../types';

const STORAGE_KEY = '@prospec_app_data_v1';
const API_URL = 'https://controles-vendas.vercel.app/api/prospects?profile=default';

const INITIAL_MOCK: Prospect[] = [
  {
    id: '1',
    razaoSocial: 'Supermercado Silva & Filhos',
    buyer: 'Sr. Antônio',
    phone: '11988887777',
    city: 'Campinas',
    region: 'Interior SP',
    contacted: 'Sim',
    rating: 'Boa',
    stage: 'Em Negociação',
    notes: 'Demonstrou interesse em sacolas personalizadas e bobinas.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    razaoSocial: 'Embalagens São Paulo LTDA',
    buyer: 'Mariana',
    phone: '11977776666',
    city: 'São Paulo',
    region: 'Grande São Paulo',
    contacted: 'Não',
    rating: 'Média',
    stage: 'Novo Prospecto',
    notes: 'Contato vindo por indicação comercial.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const StorageService = {
  async getProspects(): Promise<Prospect[]> {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data: Prospect[] = await response.json();
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.log('API Offline - usando AsyncStorage');
    }

    const localData = await AsyncStorage.getItem(STORAGE_KEY);
    if (localData) {
      return JSON.parse(localData);
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MOCK));
    return INITIAL_MOCK;
  },

  async saveProspects(prospects: Prospect[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prospects));
  },

  async addProspect(newProspect: Prospect): Promise<void> {
    const current = await this.getProspects();
    const updated = [newProspect, ...current];
    await this.saveProspects(updated);

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProspect)
      });
    } catch (e) {}
  },

  async updateProspect(id: string, patch: Partial<Prospect>): Promise<Prospect[]> {
    const current = await this.getProspects();
    const updated = current.map(p => 
      p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
    );
    await this.saveProspects(updated);

    try {
      await fetch(`https://controles-vendas.vercel.app/api/prospects/${id}?profile=default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
    } catch (e) {}

    return updated;
  }
};
