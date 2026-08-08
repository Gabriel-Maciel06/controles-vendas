export type ProspectRating = 'Boa' | 'Média' | 'Ruim' | 'Péssima';

export type ProspectStage = 
  | 'Novo Prospecto' 
  | 'Em Contato' 
  | 'Proposta Enviada' 
  | 'Em Negociação' 
  | 'Fechado / Ganho' 
  | 'Perdido';

export interface Prospect {
  id: string;
  razaoSocial: string;
  buyer: string;
  phone: string;
  city: string;
  region: string;
  instagram?: string;
  notes: string;
  contacted: 'Sim' | 'Não';
  rating: ProspectRating;
  stage: ProspectStage;
  createdAt: string;
  updatedAt: string;
}
