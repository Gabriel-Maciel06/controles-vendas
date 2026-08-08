import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { Prospect } from '../types';

interface NotesModalProps {
  visible: boolean;
  prospect: Prospect | null;
  onClose: () => void;
  onSave: (id: string, newNotes: string) => void;
}

export const NotesModal: React.FC<NotesModalProps> = ({ visible, prospect, onClose, onSave }) => {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (prospect) {
      setNotes(prospect.notes || '');
    }
  }, [prospect]);

  if (!prospect) return null;

  const insertTimestamp = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const stamp = `[${dateStr} ${timeStr}] - `;
    setNotes(prev => stamp + prev);
  };

  const handleSave = () => {
    onSave(prospect.id, notes);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>📝 Anotações do Cliente</Text>
              <Text style={styles.subtitle}>{prospect.razaoSocial} ({prospect.city})</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.toolbar}>
              <Text style={styles.label}>Histórico da Negociação:</Text>
              <TouchableOpacity onPress={insertTimestamp} style={styles.stampBtn}>
                <Text style={styles.stampBtnText}>+ Data/Hora</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={10}
              value={notes}
              onChangeText={setNotes}
              placeholder="Digite aqui o histórico de ligações, propostas e conversas..."
              placeholderTextColor="#64748b"
              textAlignVertical="top"
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Salvar Anotações</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1329'
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800'
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2
  },
  closeBtn: {
    padding: 8
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 22
  },
  body: {
    flex: 1,
    padding: 16
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  label: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700'
  },
  stampBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  stampBtnText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700'
  },
  textArea: {
    flex: 1,
    backgroundColor: '#172442',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 22
  },
  footer: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)'
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center'
  },
  cancelBtnText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700'
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  }
});
