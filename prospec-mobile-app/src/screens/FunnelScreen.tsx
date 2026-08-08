import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Linking } from 'react-native';
import { Prospect, ProspectStage } from '../types';
import { StorageService } from '../services/storage';

const STAGES: { id: ProspectStage; label: string; color: string }[] = [
  { id: 'Novo Prospecto',   label: '🎯 Novo Prospecto',   color: '#6366f1' },
  { id: 'Em Contato',       label: '📞 Em Contato',       color: '#3b82f6' },
  { id: 'Proposta Enviada', label: '💡 Proposta Enviada', color: '#f59e0b' },
  { id: 'Em Negociação',    label: '🤝 Em Negociação',    color: '#8b5cf6' },
  { id: 'Fechado / Ganho',  label: '✅ Fechado / Ganho',  color: '#10b981' },
  { id: 'Perdido',          label: '❌ Perdido',          color: '#6b7280' }
];

export const FunnelScreen: React.FC = () => {
  const [prospects, setProspects] = useState<Prospect[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await StorageService.getProspects();
    setProspects(data);
  };

  const handleMakeCall = (phone: string) => {
    const cleanNumber = phone.replace(/\D/g, '');
    if (cleanNumber) {
      Linking.openURL(`tel:+55${cleanNumber}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🤝 Funil de Negociações</Text>
        <Text style={styles.headerSub}>Acompanhe o estágio comercial dos seus clientes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {STAGES.map(stage => {
          const list = prospects.filter(p => (p.stage || 'Novo Prospecto') === stage.id);

          return (
            <View key={stage.id} style={styles.section}>
              <View style={[styles.sectionHeader, { borderLeftColor: stage.color }]}>
                <Text style={styles.sectionTitle}>{stage.label}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{list.length}</Text>
                </View>
              </View>

              {list.length === 0 ? (
                <Text style={styles.emptyText}>Sem prospectos nesta etapa</Text>
              ) : (
                list.map(item => (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{item.razaoSocial}</Text>
                    <Text style={styles.cardSub}>👤 {item.buyer || 'Contato'} • {item.city}</Text>
                    
                    {item.notes ? (
                      <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>
                    ) : null}

                    <TouchableOpacity 
                      onPress={() => handleMakeCall(item.phone)}
                      style={styles.callSmallBtn}
                    >
                      <Text style={styles.callSmallBtnText}>📞 Ligar {item.phone}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1329'
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800'
  },
  headerSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  scrollContent: {
    padding: 16
  },
  section: {
    marginBottom: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#172442',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderLeftWidth: 4,
    marginBottom: 10
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700'
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  countText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800'
  },
  card: {
    backgroundColor: '#172442',
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700'
  },
  cardSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2
  },
  notesText: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 6,
    borderRadius: 6
  },
  callSmallBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8
  },
  callSmallBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    paddingLeft: 6
  }
});
