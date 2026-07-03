import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Plus, Minus, Trash2, Wallet, LayoutGrid, RotateCcw, Mic, Play, Square, PieChart, Users, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAudioRecorder, useAudioPlayer, requestRecordingPermissionsAsync, RecordingPresets, createAudioPlayer } from 'expo-audio';

// Unique ID helper
const generateId = () => Math.random().toString(36).substr(2, 9);
const MYSELF_ID = 'default-myself-001';

interface Transaction {
  id: string;
  delta: number;
  date: string;
  note?: string;
  audioUri?: string;
  completed?: boolean;
}

interface Exchanger {
  id: string;
  name: string;
  balance: number;
  note?: string;
  audioUri?: string;
  history?: Transaction[];
}

// Extracted Card Component to support component-level Audio Player hooks
const ExchangerCard = ({ exchanger, openAdjust, deleteExchanger, promptResetBalance }: { exchanger: Exchanger, openAdjust: any, deleteExchanger: any, promptResetBalance: any }) => {
  const isNegative = (exchanger.balance || 0) < 0;
  // Initialize player, but only really matters if audioUri exists
  const player = useAudioPlayer(exchanger.audioUri || null);

  return (
    <TouchableOpacity 
      onPress={() => openAdjust(exchanger)}
      className={`w-[48%] bg-slate-900/40 border ${isNegative ? 'border-rose-500/50' : 'border-slate-700'} rounded-[35px] p-5 mb-4 shadow-lg shadow-black/20`}
    >
      <View className="flex-row justify-between items-start mb-4">
        <View className={`${isNegative ? 'bg-rose-500/10' : 'bg-indigo-500/10'} p-2.5 rounded-2xl border ${isNegative ? 'border-rose-500/20' : 'border-indigo-500/20'}`}>
          <Wallet color={isNegative ? '#f43f5e' : '#818cf8'} size={22} />
        </View>
        <TouchableOpacity onPress={() => deleteExchanger(exchanger.id)} className="p-1">
          <Trash2 color={isNegative ? '#9f1239' : '#334155'} size={16} />
        </TouchableOpacity>
      </View>
      
      <Text className={`${isNegative ? 'text-rose-400/80' : 'text-slate-400/80'} font-bold text-[10px] uppercase tracking-wider mb-1`} numberOfLines={1}>
        {exchanger.id === MYSELF_ID ? exchanger.name : (isNegative ? `${exchanger.name} ➔ Me` : `Me ➔ ${exchanger.name}`)}
      </Text>
      <Text className={`${isNegative ? 'text-rose-400' : 'text-white'} text-xl font-black leading-tight`}>
        ₹{(exchanger.balance || 0).toLocaleString('en-IN')}
      </Text>

      {/* Unified Notes Grouping */}
      {exchanger.note || exchanger.audioUri ? (
        <View className="mt-3 bg-slate-900/50 p-3 rounded-[20px] border border-slate-700">
          {exchanger.audioUri ? (
            <TouchableOpacity 
              onPress={() => {
                if (player) {
                  player.seekTo(0);
                  player.play();
                }
              }}
              className="flex-row items-center gap-1.5 mb-2 bg-indigo-500/20 px-3 py-1.5 rounded-full self-start"
            >
              <Play color="#818cf8" size={10} fill="#818cf8" />
              <Text className="text-indigo-400 text-[9px] font-black uppercase">Play Voice Note</Text>
            </TouchableOpacity>
          ) : null}

          {exchanger.note ? (
            <Text className={`${isNegative ? 'text-rose-400/80' : 'text-slate-400'} text-[10px] italic font-medium leading-[14px]`} numberOfLines={2}>
              &quot;{exchanger.note}&quot;
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className="mt-5 pt-4 border-t border-slate-700/60">
        <TouchableOpacity onPress={() => promptResetBalance(exchanger)} className="w-full bg-rose-500/10 py-2.5 rounded-[12px] border border-rose-500/30 flex-row justify-center items-center gap-1.5">
          <RotateCcw color="#f43f5e" size={10} />
          <Text className="text-rose-400 text-[8px] font-black uppercase tracking-widest text-center" numberOfLines={1} adjustsFontSizeToFit>
            Clear all transactions
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default function MoneyStac() {
  const [exchangers, setExchangers] = useState<Exchanger[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('0');
  
  const [activeExchanger, setActiveExchanger] = useState<Exchanger | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustAudioUri, setAdjustAudioUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Divide Money States
  const [divideModalVisible, setDivideModalVisible] = useState(false);
  const [divideAmount, setDivideAmount] = useState('');
  const [divideNote, setDivideNote] = useState('');
  const [includeMyself, setIncludeMyself] = useState(true);
  const [selectedExchangers, setSelectedExchangers] = useState<string[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);

  // Audio configuration for the Adjust Modal
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const adjustPlayer = useAudioPlayer(adjustAudioUri);

  async function startRecording() {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.granted) {
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setIsRecording(true);
      } else {
        Alert.alert('Permission needed', 'Please grant microphone access to record voice notes');
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    if (isRecording) {
      setIsRecording(false);
      await audioRecorder.stop();
      setAdjustAudioUri(audioRecorder.uri);
    }
  }

  // Hardware back button handler for Modals
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const onBackPress = () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      if (adjustModalVisible) {
        setAdjustModalVisible(false);
        return true;
      }
      if (adjustModalVisible) {
        setAdjustModalVisible(false);
        return true;
      }
      if (divideModalVisible) {
        setDivideModalVisible(false);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, [modalVisible, adjustModalVisible, divideModalVisible]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const saved = await AsyncStorage.getItem('exchangers');
        let parsed = [];
        if (saved) {
          try {
            parsed = JSON.parse(saved);
          } catch (pe) { console.error('Parse error:', pe); }
        }
        
        if (Array.isArray(parsed)) {
           // Ensure the permanent "Myself" exchanger exists
           const hasMyself = parsed.some(e => e.id === MYSELF_ID);
           if (!hasMyself) {
             parsed.unshift({ id: MYSELF_ID, name: 'Myself', balance: 0, history: [] });
           }
           if (isMounted) setExchangers(parsed);
        } else if (isMounted) {
           // For completely fresh installs
           setExchangers([{ id: MYSELF_ID, name: 'Myself', balance: 0, history: [] }]);
        }
        setIsLoaded(true);
      } catch (e) {
        console.error('Failed to load data:', e);
        if (isMounted) {
           setExchangers([{ id: MYSELF_ID, name: 'Myself', balance: 0, history: [] }]);
           setIsLoaded(true);
        }
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Auto-save on any change
  useEffect(() => {
    if (isLoaded) {
      const saveData = async () => {
        try {
          await AsyncStorage.setItem('exchangers', JSON.stringify(exchangers));
        } catch (e) {
          console.error('Failed to save data:', e);
        }
      };
      saveData();
    }
  }, [exchangers, isLoaded]);

  const addExchanger = () => {
    if (!newName) return Alert.alert('Error', 'Please enter a name');
    
    const nameExists = exchangers.some(e => e.name.toLowerCase().trim() === newName.toLowerCase().trim());
    if (nameExists) {
      return Alert.alert('Name Taken', 'This stack name already exists. Please choose a different name.');
    }

    const updated = [
      ...exchangers,
      { id: generateId(), name: newName.trim(), balance: parseFloat(newBalance) || 0, note: '' }
    ];
    setExchangers(updated);
    setNewName('');
    setNewBalance('0');
    setModalVisible(false);
  };

  const openAdjust = (exchanger: Exchanger) => {
    setActiveExchanger(exchanger);
    setAdjustAmount('');
    setAdjustNote(''); // Start fresh for latest note
    setAdjustAudioUri(null);
    setAdjustModalVisible(true);
  };


  const commitAdjustment = (isAdd: boolean) => {
    if (!activeExchanger) return;
    const amount = parseFloat(adjustAmount) || 0;
    const delta = isAdd ? amount : -amount;
    
    const hasDetails = adjustNote.trim().length > 0 || adjustAudioUri;

    if (!hasDetails) {
      Alert.alert('Note Required', 'Please add a note or voice note to describe this adjustment.');
      return;
    }
    
    // Create new transaction record
    const newTx: Transaction = {
       id: generateId(),
       delta,
       date: new Date().toISOString(),
       note: adjustNote.trim() || undefined,
       audioUri: adjustAudioUri || undefined
    };
    
    const updated = exchangers.map(e => {
      if (e.id === activeExchanger.id) {
        const pastHistory = e.history || [];
        const newHistory = hasDetails ? [newTx, ...pastHistory] : pastHistory;
        
        return { 
          ...e, 
          balance: e.balance + delta, 
          note: hasDetails ? adjustNote : e.note, 
          audioUri: adjustAudioUri ? adjustAudioUri : (hasDetails ? undefined : e.audioUri),
          history: newHistory
        };
      } else if (e.id === MYSELF_ID && activeExchanger.id !== MYSELF_ID && isAdd) {
        // Only save "Me -> Someone" transactions in Myself card
        const myselfDelta = -amount;
        const myselfNote = `To ${activeExchanger.name}${adjustNote.trim() ? ': ' + adjustNote.trim() : ''}`;
        
        const myselfTx: Transaction = {
          id: generateId(),
          delta: myselfDelta,
          date: new Date().toISOString(),
          note: myselfNote,
          audioUri: adjustAudioUri || undefined
        };
        
        const pastHistory = e.history || [];
        const newHistory = hasDetails ? [myselfTx, ...pastHistory] : pastHistory;
        
        return {
          ...e,
          balance: e.balance + myselfDelta,
          history: newHistory
        };
      }
      return e;
    });
    
    setExchangers(updated);
    setAdjustModalVisible(false);
    setActiveExchanger(null);
    setAdjustNote('');
    setAdjustAudioUri(null);
    setIsRecording(false);
  };

  const promptResetBalance = (exchanger: Exchanger) => {
    if ((exchanger.history || []).length === 0 && (exchanger.balance || 0) === 0) {
      return Alert.alert('Already Clear', 'There are no transactions to clear.');
    }
    
    Alert.alert(
      'Clear All Transactions', 
      `Are you sure you want to clear the active balance for ${exchanger.name}? This will set the balance to ₹0 and mark all history as completed.`, 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive', 
          onPress: () => {
            const updated = exchangers.map(e => {
              if (e.id === exchanger.id) {
                const newHistory = (e.history || []).map(tx => ({ ...tx, completed: true }));
                return { 
                  ...e, 
                  balance: 0, 
                  note: '', 
                  history: newHistory
                };
              }
              return e;
            });
            
            setExchangers(updated);
          }
        }
      ]
    );
  };

  const toggleTransactionComplete = (txId: string) => {
    if (!activeExchanger) return;
    
    const updated = exchangers.map(e => {
      if (e.id === activeExchanger.id) {
        let balanceChange = 0;
        const newHistory = (e.history || []).map(tx => {
          if (tx.id === txId) {
            balanceChange = tx.completed ? tx.delta : -tx.delta;
            return { ...tx, completed: !tx.completed };
          }
          return tx;
        });
        return { ...e, balance: e.balance + balanceChange, history: newHistory };
      }
      return e;
    });
    
    setExchangers(updated);
    
    const updatedExchanger = updated.find(e => e.id === activeExchanger.id);
    if (updatedExchanger) {
      setActiveExchanger(updatedExchanger);
    }
  };


  const commitDivide = (isAdd: boolean) => {
    const totalAmount = parseFloat(divideAmount) || 0;
    if (totalAmount <= 0) return Alert.alert('Invalid', 'Enter a valid amount to divide');
    if (selectedExchangers.length === 0 && !includeMyself) return Alert.alert('Selection Empty', 'Select at least one exchanger or yourself');
    
    // Total people division
    const divisor = selectedExchangers.length + (includeMyself ? 1 : 0);
    const amountPerPerson = parseFloat((totalAmount / divisor).toFixed(2));
    const delta = isAdd ? amountPerPerson : -amountPerPerson;
    
    const newTx = (customNote?: string): Transaction => ({
       id: generateId(),
       delta,
       date: new Date().toISOString(),
       note: customNote || (divideNote.trim() ? `Split: ${divideNote.trim()} (${divisor} ways)` : `Split Money (${divisor} ways)`),
    });
    
    const updated = exchangers.map(e => {
       const isStandardSelected = selectedExchangers.includes(e.id);
       const isMyselfAndIncluded = includeMyself && e.id === MYSELF_ID;
       
       if (isStandardSelected || isMyselfAndIncluded) {
          const pastHistory = e.history || [];
          const txNote = isMyselfAndIncluded ? (divideNote.trim() ? `My Share: ${divideNote.trim()}` : `My Share: Split`) : undefined;
          const tx = newTx(txNote);
          
          return {
             ...e,
             balance: e.balance + delta,
             note: tx.note,
             history: [tx, ...pastHistory]
          };
       }
       return e;
    });
    
    setExchangers(updated);
    setDivideModalVisible(false);
    setDivideAmount('');
    setDivideNote('');
    setSelectedExchangers([]);
  };

  const toggleSelectExchanger = (id: string) => {
    setSelectedExchangers(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteExchanger = (id: string) => {
    if (id === MYSELF_ID) {
      return Alert.alert('Restricted', 'The default "Myself" stack is permanent and cannot be deleted.');
    }
    Alert.alert('Delete', 'Remove this exchanger?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        const updated = exchangers.filter(e => e.id !== id);
        setExchangers(updated);
      }}
    ]);
  };

  const myself = exchangers.find(e => e.id === MYSELF_ID);
  const myselfBalance = myself ? (myself.balance || 0) : 0;
  const othersSum = exchangers
    .filter(e => e.id !== MYSELF_ID)
    .reduce((sum, e) => sum + (e.balance || 0), 0);
  const totalNet = myselfBalance - othersSum;

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-4 relative">
      <StatusBar style="light" />
      
      {/* Header Widget */}
      <View className="py-8">
        <View className="bg-slate-900 border border-indigo-500/20 rounded-[40px] p-6 shadow-2xl overflow-hidden relative">
          <View className="flex-row justify-between items-center z-10">
            <View>
              <Text className="text-slate-500 text-xs font-bold uppercase tracking-[2px] mb-1">Portfolio Net</Text>
              <Text className="text-white text-4xl font-black tracking-tight">
                ₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity 
                onPress={() => setDivideModalVisible(true)}
                className="bg-indigo-500/20 w-12 h-12 rounded-full items-center justify-center border border-indigo-500/40"
              >
                <PieChart color="#818cf8" size={20} strokeWidth={2.5} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setModalVisible(true)}
                className="bg-white w-14 h-14 rounded-full items-center justify-center shadow-xl shadow-indigo-500/50"
              >
                <Plus color="#4f46e5" size={32} strokeWidth={3} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Abstract background shape */}
          <View className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full" />
        </View>
      </View>

      {/* Search Bar */}
      <View className="mb-6">
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search stacs..."
          placeholderTextColor="#475569"
          className="bg-slate-900/50 text-white p-4 rounded-2xl border border-slate-800 font-bold"
        />
      </View>

      {/* Grid of Money Exchangers */}
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
        className="flex-1"
      >
        <Text className="text-slate-400 text-xs font-black uppercase tracking-[2px] mb-4 ml-2">Exchangers</Text>
        <View className="flex-row flex-wrap justify-between">
          {exchangers
            .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => {
              if (a.id === MYSELF_ID) return -1;
              if (b.id === MYSELF_ID) return 1;
              return (b.balance || 0) - (a.balance || 0);
            })
            .map((exchanger) => (
              <ExchangerCard 
                key={exchanger.id} 
                exchanger={exchanger} 
                openAdjust={openAdjust} 
                deleteExchanger={deleteExchanger} 
                promptResetBalance={promptResetBalance}
              />
            ))
          }
          
          {exchangers.length === 0 && (
            <View className="w-full mt-20 items-center justify-center">
              <View className="bg-slate-900/50 p-10 rounded-full border border-slate-800 mb-6">
                <LayoutGrid color="#1e293b" size={48} />
              </View>
              <Text className="text-slate-500 text-center font-medium px-10">
                Your stack is empty.{'\n'}Create an exchanger to begin.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Exchanger Modal (No longer using native Modal component to prevent NavigationContainer crashes during permissions!) */}
      {modalVisible && (
        <View className="absolute inset-0 z-50 justify-end bg-slate-950/90">
          <KeyboardAvoidingView 
            behavior="padding"
            className="w-full flex-1 justify-end"
          >
            <View className="bg-[#0f172a] rounded-t-[50px] p-8 pb-12 border-t border-slate-800 shadow-2xl">
              <View className="w-16 h-1.5 bg-slate-800 rounded-full self-center mb-10" />
              <Text className="text-white text-3xl font-black tracking-tight mb-8">New Stack</Text>
              
              <View className="gap-6">
                <View>
                  <Text className="text-slate-500 text-[10px] mb-3 uppercase tracking-[3px] font-black">Entity Name</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="e.g. Cold Wallet, Bank A, Cash"
                    placeholderTextColor="#334155"
                    className="bg-slate-900/80 text-white p-5 rounded-[25px] border border-slate-800 font-bold text-lg shadow-inner"
                  />
                </View>

                <View>
                  <Text className="text-slate-500 text-[10px] mb-3 uppercase tracking-[3px] font-black">Initial Stac</Text>
                  <TextInput
                    value={newBalance}
                    onChangeText={setNewBalance}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#334155"
                    scrollEnabled={false}
                    multiline={false}
                    onWheel={Platform.OS === 'web' ? (e: any) => e.target.blur() : undefined}
                    className="bg-slate-900/80 text-white h-24 px-6 rounded-[25px] border border-slate-800 font-black text-4xl shadow-inner"
                  />
                </View>

                <View className="flex-row gap-4 mt-6">
                  <TouchableOpacity 
                    onPress={() => setModalVisible(false)}
                    className="flex-1 bg-slate-900 py-5 rounded-[25px] items-center border border-slate-800"
                  >
                    <Text className="text-slate-400 font-black tracking-widest uppercase text-xs">Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={addExchanger}
                    className="flex-[2] bg-indigo-600 py-5 rounded-[25px] items-center shadow-lg shadow-indigo-600/30"
                  >
                    <Text className="text-white font-black tracking-widest uppercase text-xs">Create Stac</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Adjust Balance Overlay */}
      {adjustModalVisible && (
        <View className="absolute inset-0 z-50 justify-start pt-24 items-center bg-slate-950/95 px-6">
          <View className="w-full">
            <View className="w-full bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-2xl">
              <View className="flex-row justify-between items-start mb-8">
                <View className="flex-1">
                  <Text className="text-slate-500 text-[10px] mb-1 uppercase tracking-[3px] font-black">Adjusting</Text>
                  <Text className="text-white text-2xl font-black uppercase tracking-tight" numberOfLines={1}>
                    {activeExchanger?.name}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-slate-500 text-[10px] mb-1 uppercase tracking-[3px] font-black">Total</Text>
                  <Text className={`text-xl font-black ${(activeExchanger?.balance || 0) < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                    ₹{Math.abs(activeExchanger?.balance || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
              
              <TextInput
                autoFocus
                value={adjustAmount}
                onChangeText={setAdjustAmount}
                keyboardType="numeric"
                placeholder="₹ 0.00"
                placeholderTextColor="#334155"
                multiline={false}
                scrollEnabled={false}
                onWheel={Platform.OS === 'web' ? (e: any) => e.target.blur() : undefined}
                className="text-white text-5xl font-black text-center h-20 mb-8"
              />

              <View className="mb-8">
                <View className="flex-row justify-between items-end mb-3">
                  <Text className="text-slate-500 text-[10px] uppercase tracking-[3px] font-black">Transaction Details</Text>
                  
                  {/* Play Voice Note tightly grouping with the details label */}
                  {adjustAudioUri && !isRecording && (
                     <View className="flex-row items-center gap-2">
                       <TouchableOpacity onPress={() => setAdjustAudioUri(null)}>
                         <Text className="text-rose-500/80 text-[9px] font-black uppercase tracking-widest mr-2">Clear</Text>
                       </TouchableOpacity>
                       <TouchableOpacity 
                         onPress={() => {
                           if (adjustPlayer) {
                             adjustPlayer.seekTo(0);
                             adjustPlayer.play();
                           }
                         }}
                         className="flex-row items-center gap-1 bg-indigo-500 px-2 py-1 rounded-[10px]"
                       >
                         <Play color="white" size={10} fill="white" />
                         <Text className="text-white font-black text-[9px] uppercase">Play</Text>
                       </TouchableOpacity>
                     </View>
                  )}
                </View>

                <View className="flex-row gap-2 relative">
                  {/* Note Input */}
                  <TextInput
                    value={adjustNote}
                    onChangeText={setAdjustNote}
                    placeholder="Note (e.g. Rent, Freelance...)"
                    placeholderTextColor="#334155"
                    scrollEnabled={false}
                    multiline={false}
                    className="flex-1 bg-slate-900/80 text-white p-5 rounded-[25px] border border-slate-800 font-bold text-lg shadow-inner"
                  />
                  <TouchableOpacity 
                    onPress={isRecording ? stopRecording : startRecording}
                    className={`w-16 h-16 rounded-[25px] items-center justify-center border ${isRecording ? 'bg-rose-500 border-rose-400' : 'bg-slate-900 border-slate-800'}`}
                  >
                    {isRecording ? <Square color="white" size={24} /> : <Mic color={adjustAudioUri ? '#10b981' : '#64748b'} size={24} />}
                  </TouchableOpacity>
                </View>
              </View>
              
              {activeExchanger?.id === MYSELF_ID ? (
                <View className="flex-row gap-3">
                  <TouchableOpacity 
                    onPress={() => commitAdjustment(false)}
                    className="flex-[2] bg-rose-500/10 border border-rose-500/30 py-6 rounded-[30px] items-center justify-center"
                  >
                    <Text className="text-rose-500 font-black text-base uppercase tracking-widest text-center">
                      Me ➔ 
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => commitAdjustment(true)}
                    className="flex-[1] bg-emerald-500/10 border border-emerald-500/30 py-6 px-2 rounded-[30px] items-center justify-center"
                  >
                    <Text className="text-emerald-500 font-black text-[10px] uppercase tracking-widest text-center">
                      ➔ Me
                    </Text>
                    <Text className="text-emerald-500 font-bold text-[8px] uppercase tracking-widest text-center mt-1">
                      (Add)
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="flex-row gap-4">
                  <TouchableOpacity 
                    onPress={() => commitAdjustment(false)}
                    className="flex-1 bg-rose-500/10 border border-rose-500/30 py-6 px-2 rounded-[30px] items-center justify-center"
                  >
                    <Text className="text-rose-500 font-black text-base uppercase tracking-widest text-center">
                      {activeExchanger?.name} ➔ Me
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => commitAdjustment(true)}
                    className="flex-1 bg-emerald-500/10 border border-emerald-500/30 py-6 px-2 rounded-[30px] items-center justify-center"
                  >
                    <Text className="text-emerald-500 font-black text-base uppercase tracking-widest text-center">
                      Me ➔ {activeExchanger?.name}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* History Bars */}
              {(activeExchanger?.history || []).length > 0 && (
                <View className="mt-6 mb-2 max-h-[250px]">
                  <Text className="text-slate-500 text-[10px] uppercase tracking-[3px] font-black mb-3">Recent History</Text>
                  <ScrollView showsVerticalScrollIndicator={false} className="flex-col">
                    {activeExchanger?.history?.map(tx => (
                      <TouchableOpacity 
                        key={tx.id}
                        onPress={() => !tx.completed && toggleTransactionComplete(tx.id)}
                        onLongPress={() => tx.completed && toggleTransactionComplete(tx.id)}
                        delayLongPress={500}
                        className={`p-4 rounded-[20px] mb-3 border ${tx.completed ? 'bg-slate-800/20 border-slate-800/50 opacity-50' : 'bg-slate-800/80 border-slate-700'}`}
                      >
                        <View className="flex-row justify-between items-center mb-2 gap-3">
                          <View className="flex-row items-center gap-2">
                            <Text className={`${tx.completed ? 'text-slate-600' : 'text-slate-400'} font-black text-[9px] uppercase tracking-wider`}>
                              {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </Text>
                            <Text className={`font-black text-[8px] uppercase tracking-widest ${tx.completed ? 'text-slate-600' : 'text-slate-400'}`}>
                              {activeExchanger?.id === MYSELF_ID ? (tx.delta >= 0 ? '➔ Me' : 'Me ➔') : (tx.delta >= 0 ? `Me ➔ ${activeExchanger?.name}` : `${activeExchanger?.name} ➔ Me`)}
                            </Text>
                          </View>
                          <Text className={`font-black text-sm ${tx.completed ? 'text-slate-500' : (tx.delta >= 0 ? 'text-emerald-500' : 'text-rose-500')}`}>
                            ₹{Math.abs(tx.delta).toLocaleString('en-IN')}
                          </Text>
                        </View>
                        {tx.note && <Text className={`${tx.completed ? 'text-slate-600' : 'text-slate-300'} text-xs italic font-medium`} numberOfLines={1}>&quot;{tx.note}&quot;</Text>}
                        {tx.completed ? (
                          <Text className="text-slate-600 text-[9px] font-black uppercase tracking-widest mt-2 text-left">Hold to recover</Text>
                        ) : (
                          <Text className="text-indigo-400 text-[9px] font-black uppercase tracking-widest mt-2 text-left">Tap to Complete</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity 
                onPress={() => {
                  setAdjustModalVisible(false);
                  setIsRecording(false);
                }}
                className="mt-6 items-center"
              >
                <Text className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}


      {/* Divide Money (Split) Overlay */}
      {divideModalVisible && (
        <View className="absolute inset-0 z-50 justify-end bg-slate-950/95">
          <KeyboardAvoidingView behavior="padding" className="w-full">
            <View className="bg-slate-900 border-t border-slate-800 rounded-t-[40px] p-6 pt-8 max-h-[90%] shadow-2xl">
              <View className="flex-row justify-between items-center mb-6">
                 <View>
                   <Text className="text-slate-500 text-[10px] uppercase tracking-[3px] font-black">Distribute Funds</Text>
                   <Text className="text-white text-3xl font-black mt-1 tracking-tight">Split Money</Text>
                 </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                <View className="gap-4">
                  <View>
                    <TextInput
                      value={divideAmount}
                      onChangeText={setDivideAmount}
                      keyboardType="numeric"
                      placeholder="Total Amount (₹ 0.00)"
                      placeholderTextColor="#334155"
                      className="bg-slate-950 text-emerald-400 p-5 rounded-[25px] border border-slate-800 font-black text-2xl shadow-inner text-center"
                    />
                  </View>

                  <View>
                    <TextInput
                      value={divideNote}
                      onChangeText={setDivideNote}
                      placeholder="Note (e.g. Dinner, Rent...)"
                      placeholderTextColor="#334155"
                      className="bg-slate-950 text-white p-5 rounded-[20px] border border-slate-800 font-bold text-sm shadow-inner"
                    />
                  </View>

                  <TouchableOpacity 
                    onPress={() => setIncludeMyself(!includeMyself)}
                    className={`flex-row items-center justify-between p-4 rounded-[20px] border ${includeMyself ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-950 border-slate-800'}`}
                  >
                    <View className="flex-row items-center gap-3">
                      <Users color={includeMyself ? '#818cf8' : '#475569'} size={20} />
                      <Text className={`font-black uppercase tracking-widest text-[11px] ${includeMyself ? 'text-indigo-400' : 'text-slate-500'}`}>Include Myself in math</Text>
                    </View>
                    <View className={`w-6 h-6 rounded-md border items-center justify-center ${includeMyself ? 'bg-indigo-500 border-indigo-400' : 'border-slate-700'}`}>
                       {includeMyself && <Text className="text-white font-black text-xs">✓</Text>}
                    </View>
                  </TouchableOpacity>

                  <View className="mt-2">
                    <Text className="text-slate-500 text-[10px] uppercase tracking-[3px] font-black mb-3 ml-2">Select Exchangers</Text>
                    {exchangers.filter(e => e.id !== MYSELF_ID).length === 0 ? (
                       <Text className="text-slate-500 text-xs italic text-center py-4">No additional exchangers available.</Text>
                    ) : (
                      exchangers.filter(e => e.id !== MYSELF_ID).map(e => {
                        const isSelected = selectedExchangers.includes(e.id);
                        return (
                          <TouchableOpacity 
                            key={e.id}
                            onPress={() => toggleSelectExchanger(e.id)}
                            className={`flex-row items-center justify-between p-4 rounded-[20px] mb-2 border ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950 border-slate-800'}`}
                          >
                            <Text className={`font-bold text-sm ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>{e.name}</Text>
                            <View className={`w-6 h-6 rounded-md border items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-400' : 'border-slate-700'}`}>
                               {isSelected && <Text className="text-white font-black text-xs">✓</Text>}
                            </View>
                          </TouchableOpacity>
                        )
                      })
                    )}
                  </View>
                </View>

                {/* Math Preview */}
                <View className="bg-indigo-500/10 p-5 rounded-[20px] mt-4 border border-indigo-500/20 items-center">
                  <Text className="text-slate-400 text-[10px] uppercase tracking-[2px] font-black mb-1">Mathematical Split</Text>
                  <Text className="text-indigo-400 text-lg font-black tracking-tight">
                    ₹{(parseFloat(divideAmount) || 0).toLocaleString('en-IN')} ÷ {selectedExchangers.length + (includeMyself ? 1 : 0)} = 
                    <Text className="text-white"> ₹{((parseFloat(divideAmount) || 0) / (selectedExchangers.length + (includeMyself ? 1 : 0) || 1)).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})} </Text>
                  </Text>
                  <Text className="text-indigo-300 text-[9px] uppercase tracking-widest mt-1 opacity-70">Per Person Selected</Text>
                </View>
                
                <View className="h-6" />
              </ScrollView>

              <View className="flex-row gap-4 mb-2">
                <TouchableOpacity 
                  onPress={() => commitDivide(false)}
                  className="flex-[1] bg-rose-500/10 border border-rose-500/30 py-5 rounded-[25px] items-center"
                >
                  <Minus color="#f43f5e" size={20} strokeWidth={3} />
                  <Text className="text-rose-500 font-black text-[9px] uppercase mt-2 tracking-widest">Charge Debt</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => commitDivide(true)}
                  className="flex-[1.5] bg-emerald-500 border border-emerald-400 py-5 rounded-[25px] items-center"
                >
                  <Plus color="white" size={20} strokeWidth={3} />
                  <Text className="text-emerald-950 font-black text-[9px] uppercase mt-2 tracking-widest">Deposit Share</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                onPress={() => {
                  setDivideModalVisible(false);
                  setDivideAmount('');
                  setSelectedExchangers([]);
                }}
                className="mt-4 mb-6 items-center"
              >
                <Text className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Guide / Legend Button at Absolute Bottom Right */}
      <TouchableOpacity 
        onPress={() => Alert.alert('Balance Guide', '(-) Name ➔ Me (He/she gives me)\n\n(+) Me ➔ Name (I give him/her)')}
        className="absolute bottom-10 right-6 bg-slate-900/80 border border-slate-800 w-12 h-12 rounded-full items-center justify-center shadow-lg shadow-black/40"
      >
        <Text className="text-indigo-500/80 font-black text-xl">?</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}
