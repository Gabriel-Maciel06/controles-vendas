import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  StyleSheet, 
  Linking, 
  Alert, 
  SafeAreaView 
} from 'react-native';
import { Prospect } from '../types';
import { StorageService } from '../services/storage';
import { NotesModal } from '../components/NotesModal';

export const HomeScreen: React.FC = () => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await StorageService.getProspects();
    setProspects(data);
  };

  const handleMakeCall = (phone: string) => {
    const cleanNumber = phone.replace(/\D/g, '');
    if (!cleanNumber) {
      Alert.alert('Erro', 'Número de telefone inválido.');
      return;
    }
    const telUrl = `tel:+55${cleanNumber}`;
    Linking.canOpenURL(telUrl).then(supported => {
      if (supported) {
        Linking.openURL(telUrl);
      } else {
        Alert.alert('Discador Indisponível', `Número para chamar: ${phone}`);
      }
    });
  };

  const toggleContacted = async (p: Prospect) => {
    const newStatus = p.contacted === 'Sim' ? 'Não' : 'Sim';
    const updated = await StorageService.updateProspect(p.id, { contacted: newStatus });
    setProspects(updated);
  };

  const saveNotes = async (id: string, newNotes: string) => {
    const updated = await StorageService.updateProspect(id, { notes: newNotes });
    setProspects(updated);
  };

  const filtered = prospects.filter(p => {
    const query = search.toLowerCase();
    return (
      (p.razaoSocial || '').toLowerCase().includes(query) ||
      (p.buyer || '').toLowerCase().includes(query) ||
      (p.city || '').toLowerCase().includes(query) ||
      (p.phone || '').includes(query)
    );
  });

  const renderCard = ({ item }: { item: Prospect }) => {
    const isContacted = item.contacted === 'Sim';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.companyName}>{item.razaoSocial}</Text>
            <Text style={styles.buyerText}>👤 {item.buyer || 'Contato'} • 📍 {item.city}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => { setSelectedProspect(item); setModalVisible(true); }}
            style={styles.notesBtn}
          >
            <Text style={styles.notesBtnText}>📝 Notas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.badgeRow}>
          <TouchableOpacity 
            onPress={() => toggleContacted(item)}
            style={[styles.badge, isContacted ? styles.badgeYes : styles.badgeNo]}
          >
            <Text style={[styles.badgeText, isContacted ? styles.badgeYesText : styles.badgeNoText]}>
              {isContacted ? '🟢 Já Ligou' : '⚪ Não Ligou'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.badge, styles.ratingBadge]}>
            <Text style={styles.ratingBadgeText}>Avaliação: {item.rating}</Text>
          </View>
        </View>

        {item.notes ? (
          <Text style={styles.notesPreview} numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}

        {/* BOTÃO PRINCIPAL NATIVO DE CHAMADA TELEFÔNICA (Linking.openURL tel:) */}
        <TouchableOpacity 
          onPress={() => handleMakeCall(item.phone)} 
          style={styles.callBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.callBtnIcon}>📞</Text>
          <Text style={styles.callBtnText}>Ligar para {item.phone}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📞 Prospecção Nativa</Text>
        <Text style={styles.headerSub}>Toque no botão para discar direto do celular</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por cliente, comprador ou cidade..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderCard}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum prospecto encontrado.</Text>
          </View>
        }
      />

      <NotesModal
        visible={modalVisible}
        prospect={selectedProspect}
        onClose={() => setModalVisible(false)}
        onSave={saveNotes}
      />
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
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8
  },
  searchInput: {
    backgroundColor: '#172442',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14
  },
  card: {
    backgroundColor: '#172442',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  companyName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800'
  },
  buyerText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 3
  },
  notesBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  notesBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700'
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1
  },
  badgeYes: {
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    borderColor: 'rgba(37, 211, 102, 0.3)'
  },
  badgeYesText: {
    color: '#25D366',
    fontSize: 12,
    fontWeight: '700'
  },
  badgeNo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  badgeNoText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700'
  },
  ratingBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.3)'
  },
  ratingBadgeText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700'
  },
  notesPreview: {
    color: '#cbd5e1',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10
  },
  callBtn: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 4
  },
  callBtnIcon: {
    fontSize: 16
  },
  callBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center'
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14
  }
});
