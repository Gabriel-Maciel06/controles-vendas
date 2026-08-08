import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  SafeAreaView, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { StorageService } from '../services/storage';
import { Prospect } from '../types';

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [razaoSocial, setRazaoSocial] = useState('');
  const [buyer, setBuyer] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [notes, setNotes] = useState('');

  const handleCityChange = (text: string) => {
    setCity(text);
    const lower = text.toLowerCase();
    if (['campinas', 'ribeirão preto', 'sorocaba', 'jaú', 'bauru'].some(c => lower.includes(c))) {
      setRegion('Interior SP');
    } else if (['são paulo', 'guarulhos', 'osasco', 'santo andré'].some(c => lower.includes(c))) {
      setRegion('Grande SP');
    }
  };

  const handleSave = async () => {
    if (!razaoSocial.trim() || !phone.trim() || !city.trim()) {
      Alert.alert('Atenção', 'Por favor, preencha a Razão Social, Telefone e Cidade.');
      return;
    }

    const newP: Prospect = {
      id: 'p_' + Date.now(),
      razaoSocial: razaoSocial.trim(),
      buyer: buyer.trim(),
      phone: phone.trim(),
      city: city.trim(),
      region: region.trim() || 'Outros',
      notes: notes.trim(),
      contacted: 'Não',
      rating: 'Média',
      stage: 'Novo Prospecto',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await StorageService.addProspect(newP);
    Alert.alert('Sucesso', 'Prospecto cadastrado com sucesso!');

    setRazaoSocial('');
    setBuyer('');
    setPhone('');
    setCity('');
    setRegion('');
    setNotes('');

    navigation.navigate('Lista');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>➕ Cadastrar Prospecto</Text>
          <Text style={styles.subtitle}>Preencha os dados do cliente para iniciar o contato</Text>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Razão Social / Nome da Empresa *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Supermercado Silva LTDA"
                placeholderTextColor="#64748b"
                value={razaoSocial}
                onChangeText={setRazaoSocial}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nome do Comprador / Contato</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Sr. Antônio / Ana"
                placeholderTextColor="#64748b"
                value={buyer}
                onChangeText={setBuyer}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Telefone / WhatsApp *</Text>
              <TextInput
                style={styles.input}
                placeholder="(11) 98888-7777"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Cidade *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Campinas"
                  placeholderTextColor="#64748b"
                  value={city}
                  onChangeText={handleCityChange}
                />
              </View>

              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Região</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Interior SP"
                  placeholderTextColor="#64748b"
                  value={region}
                  onChangeText={setRegion}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Anotações Iniciais</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Observações iniciais do cliente..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Salvar e Abrir Ligações</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1329'
  },
  scrollContent: {
    padding: 16
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800'
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16
  },
  form: {
    gap: 12
  },
  field: {
    gap: 4
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700'
  },
  input: {
    backgroundColor: '#172442',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14
  },
  textArea: {
    minHeight: 100
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  }
});
