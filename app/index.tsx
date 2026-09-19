import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  BackHandler 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Wallet, 
  LayoutGrid, 
  List as ListIcon, 
  RotateCcw, 
  Mic, 
  Play, 
  Square, 
  PieChart, 
  Users, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Search, 
  TrendingUp, 
  TrendingDown, 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  SlidersHorizontal, 
  X, 
  FileText, 
  Target, 
  Check,
  Pin 
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAudioRecorder, useAudioPlayer, requestRecordingPermissionsAsync, RecordingPresets } from 'expo-audio';

// Unique ID helper
const generateId = () => Math.random().toString(36).substring(2, 11);
const MYSELF_ID = 'default-myself-001';

interface Transaction {
  id: string;
  delta: number;
  date: string;
  note?: string;
  audioUri?: string;
  completed?: boolean;
  exchangerId?: string;
  exchangerName?: string;
}

interface Exchanger {
  id: string;
  name: string;
  balance: number;
  note?: string;
  audioUri?: string;
  history?: Transaction[];
  pinned?: boolean;
}

// Initial fallback data to match user's pristine setup
const INITIAL_EXCHANGERS: Exchanger[] = [
  {
    id: MYSELF_ID,
    name: 'MYSELF',
    balance: -25885,
    note: 'Ice cream',
    history: [
      { id: 'tx-01', delta: -1000, date: '2026-09-01T10:00:00.000Z', note: 'Groceries' },
      { id: 'tx-03', delta: -3200, date: '2026-09-03T11:15:00.000Z', note: 'Supplies' },
      { id: 'tx-04', delta: -5600, date: '2026-09-04T12:00:00.000Z', note: 'Advance' },
      { id: 'tx-05', delta: -140, date: '2026-09-05T16:20:00.000Z', note: 'Snacks' },
      { id: 'tx-06', delta: -396, date: '2026-09-06T18:00:00.000Z', note: 'Dinner' },
      { id: 'tx-07', delta: -305, date: '2026-09-07T12:45:00.000Z', note: 'Lunch' },
      { id: 'tx-08', delta: -270, date: '2026-09-08T15:30:00.000Z', note: 'Coffee' },
      { id: 'tx-09', delta: -200, date: '2026-09-09T17:00:00.000Z', note: 'Stationery' },
      { id: 'tx-10', delta: -360, date: '2026-09-10T19:00:00.000Z', note: 'Fuel' },
      { id: 'tx-11', delta: -105, date: '2026-09-11T13:09:00.000Z', note: 'Chaap' },
      { id: 'tx-12', delta: -87, date: '2026-09-12T11:00:00.000Z', note: 'Tea' },
      { id: 'tx-13', delta: -50, date: '2026-09-13T10:30:00.000Z', note: 'Photocopy' },
      { id: 'tx-14', delta: -1100, date: '2026-09-14T20:00:00.000Z', note: 'Dinner outing' },
      { id: 'tx-15', delta: -250, date: '2026-09-15T13:00:00.000Z', note: 'Lunch' },
      { id: 'tx-16', delta: -257, date: '2026-09-16T14:00:00.000Z', note: 'Snacks' },
      { id: 'tx-17e', delta: -35, date: '2026-09-17T10:00:00.000Z', note: 'Snacks' },
      { id: 'tx-17d', delta: -50, date: '2026-09-17T12:00:00.000Z', note: 'Chana samosa' },
      { id: 'tx-17c', delta: -100, date: '2026-09-17T13:30:00.000Z', note: 'Dosa' },
      { id: 'tx-17b', delta: -25, date: '2026-09-17T15:00:00.000Z', note: 'To Hemant: Momos' },
      { id: 'tx-17a', delta: -50, date: '2026-09-17T17:00:00.000Z', note: 'Roll' },
      { id: 'tx-18a', delta: -60, date: '2026-09-18T12:00:00.000Z', note: 'Paratha' },
      { id: 'tx-18b', delta: -50, date: '2026-09-18T14:30:00.000Z', note: 'Punugulu' },
      { id: 'tx-18c', delta: -45, date: '2026-09-18T16:00:00.000Z', note: 'Ice cream' },
      { id: 'tx-19a', delta: -65, date: '2026-09-19T12:30:00.000Z', note: 'Lunch' },
      { id: 'tx-19b', delta: -40, date: '2026-09-19T16:00:00.000Z', note: 'Tea & biscuits' },
      { id: 'tx-19c', delta: -50, date: '2026-09-19T19:45:00.000Z', note: 'Ice cream' }
    ]
  },
  {
    id: 'ex-aakash',
    name: 'AAKASH',
    balance: -680,
    note: 'Split: Paratha (2 ways)',
    history: [
      { id: 'tx-ak1', delta: -680, date: '2026-09-16T12:00:00.000Z', note: 'Split: Paratha (2 ways)' }
    ]
  },
  {
    id: 'ex-aaman',
    name: 'AAMAN',
    balance: -564,
    note: 'Refer by hemant',
    history: [
      { id: 'tx-am1', delta: -564, date: '2026-09-15T15:00:00.000Z', note: 'Refer by hemant' }
    ]
  },
  {
    id: 'ex-dheeraj',
    name: 'DHEERAJ',
    balance: -463,
    note: 'Pizza',
    history: [
      { id: 'tx-dh1', delta: -463, date: '2026-09-14T19:30:00.000Z', note: 'Pizza' }
    ]
  },
  {
    id: 'ex-suvham',
    name: 'SUVHAM',
    balance: -324,
    note: '',
    history: []
  },
  {
    id: 'ex-hemant',
    name: 'HEMANT',
    balance: -250,
    note: '',
    history: []
  },
  {
    id: 'ex-gurcyber',
    name: 'GURCYBER',
    balance: -152,
    note: '',
    history: []
  }
];

// August benchmark data matching screenshot (total: 15,365.83)
const AUG_BENCHMARK: Record<number, number> = {
  1: 1200, 2: 1500, 3: 400, 4: 3800, 5: 300, 6: 200, 7: 150, 8: 200, 9: 100, 
  10: 150, 11: 180, 12: 120, 13: 80, 14: 150, 15: 100, 16: 120, 17: 200, 
  18: 150, 19: 100, 20: 80, 21: 100, 22: 120, 23: 150, 24: 180, 25: 2200, 
  26: 300, 27: 2800, 28: 200, 29: 150, 30: 1000, 31: 185.83
};

// Grid View Exchanger Card (Image 4)
const ExchangerGridCard = ({ 
  exchanger, 
  openAdjust, 
  deleteExchanger, 
  promptResetBalance,
  togglePinExchanger
}: { 
  exchanger: Exchanger; 
  openAdjust: (ex: Exchanger) => void; 
  deleteExchanger: (id: string) => void; 
  promptResetBalance: (ex: Exchanger) => void; 
  togglePinExchanger: (id: string) => void;
}) => {
  const isNegative = (exchanger.balance || 0) < 0;
  const isMyself = exchanger.id === MYSELF_ID;
  const isPinned = !!exchanger.pinned;
  const isMeTo = !isMyself && !isNegative;
  const title = isMyself ? exchanger.name : (isNegative ? `${exchanger.name} ➔ ME` : `ME ➔ ${exchanger.name}`);

  return (
    <View className={`w-[48.5%] h-[215px] bg-white border-2 ${isPinned || isMeTo ? 'border-[#00a2ed]' : 'border-rose-400'} rounded-[14px] p-3.5 mb-3 shadow-xs justify-between`}>
      <View>
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-start gap-2">
            <TouchableOpacity 
              onPress={() => openAdjust(exchanger)}
              className={`w-10 h-10 rounded-[10px] ${isPinned || isMeTo ? 'bg-sky-50 border-2 border-sky-400' : 'bg-rose-50 border-2 border-rose-400'} items-center justify-center`}
            >
              <Wallet color={isPinned || isMeTo ? '#00a2ed' : '#e11d48'} size={19} strokeWidth={2} />
            </TouchableOpacity>

            {!isMyself && (
              <TouchableOpacity
                onPress={() => togglePinExchanger(exchanger.id)}
                className={`w-7 h-7 rounded-[7px] border-2 ${isPinned ? 'bg-sky-50 border-sky-400' : 'bg-white border-slate-300'} items-center justify-center`}
                accessibilityLabel={isPinned ? 'Unpin stack' : 'Pin stack to top'}
              >
                <Pin 
                  color={isPinned ? '#00a2ed' : '#94a3b8'} 
                  size={12} 
                  strokeWidth={2} 
                  fill={isPinned ? '#00a2ed' : 'transparent'}
                />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            onPress={() => deleteExchanger(exchanger.id)} 
            className="p-1"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 color="#e11d48" size={15} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => openAdjust(exchanger)}>
          <Text className={`${isPinned || isMeTo ? 'text-[#00a2ed]' : 'text-rose-700'} font-black text-xs uppercase tracking-wider mb-1`} numberOfLines={1}>
            {title}
          </Text>
          <Text className={`${isMeTo ? 'text-[#00a2ed]' : 'text-rose-600'} text-2xl font-black mb-1.5 tracking-tight`} numberOfLines={1}>
            ₹{Math.round(exchanger.balance || 0).toLocaleString('en-IN')}
          </Text>
        </TouchableOpacity>

        {/* Fixed height container for Note bubble */}
        <View className="h-[42px] justify-center mb-1">
          {exchanger.note ? (
            <View className="bg-slate-50/50 border-2 border-slate-400 rounded-[10px] p-1.5 justify-center">
              <Text className="text-slate-700 text-[11px] italic font-medium leading-4" numberOfLines={2}>
                &quot;{exchanger.note}&quot;
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View>
        {/* Thicker, more visible plain line between note and clear all button */}
        <View className="w-full h-[2px] bg-slate-400 my-2" />

        <TouchableOpacity 
          onPress={() => promptResetBalance(exchanger)} 
          className="w-full bg-rose-50/70 py-2 rounded-[8px] border-2 border-rose-400 flex-row justify-center items-center gap-1.5 active:bg-rose-100"
          accessibilityLabel="Clear all balance"
        >
          <RotateCcw color="#e11d48" size={10} strokeWidth={2.5} />
          <Text className="text-rose-600 text-[9px] font-black uppercase tracking-widest text-center" numberOfLines={1}>
            CLEAR ALL
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// List View Exchanger Card
const ExchangerListCard = ({ 
  exchanger, 
  openAdjust, 
  deleteExchanger, 
  promptResetBalance,
  togglePinExchanger
}: { 
  exchanger: Exchanger; 
  openAdjust: (ex: Exchanger) => void; 
  deleteExchanger: (id: string) => void; 
  promptResetBalance: (ex: Exchanger) => void; 
  togglePinExchanger: (id: string) => void;
}) => {
  const isNegative = (exchanger.balance || 0) < 0;
  const isMyself = exchanger.id === MYSELF_ID;
  const isPinned = !!exchanger.pinned;
  const isMeTo = !isMyself && !isNegative;
  const title = isMyself ? exchanger.name : (isNegative ? `${exchanger.name} ➔ ME` : `ME ➔ ${exchanger.name}`);

  return (
    <View className={`h-[74px] bg-white border-2 ${isPinned || isMeTo ? 'border-[#00a2ed]' : 'border-rose-400'} rounded-[14px] px-3 py-2.5 mb-2.5 flex-row items-center justify-between shadow-xs`}>
      <View className="flex-row items-center flex-1 mr-2">
        <View className="flex-row items-start gap-2 mr-2.5">
          <TouchableOpacity 
            onPress={() => openAdjust(exchanger)}
            className={`w-10 h-10 rounded-[10px] ${isPinned || isMeTo ? 'bg-sky-50 border-2 border-sky-400' : 'bg-rose-50 border-2 border-rose-400'} items-center justify-center`}
          >
            <Wallet color={isPinned || isMeTo ? '#00a2ed' : '#e11d48'} size={19} strokeWidth={2} />
          </TouchableOpacity>

          {!isMyself && (
            <TouchableOpacity 
              onPress={() => togglePinExchanger(exchanger.id)}
              className={`w-7 h-7 rounded-[7px] border-2 ${isPinned ? 'bg-sky-50 border-sky-400' : 'bg-white border-slate-400'} items-center justify-center`}
              accessibilityLabel={isPinned ? 'Unpin stack' : 'Pin stack to top'}
            >
              <Pin 
                color={isPinned ? '#00a2ed' : '#64748b'} 
                size={12} 
                strokeWidth={2} 
                fill={isPinned ? '#00a2ed' : 'transparent'} 
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          onPress={() => openAdjust(exchanger)}
          className="flex-1 justify-center"
        >
          <Text className={`${isPinned || isMeTo ? 'text-[#00a2ed]' : 'text-rose-700'} font-black text-xs uppercase tracking-wider`} numberOfLines={1}>
            {title}
          </Text>
          <Text className={`${isMeTo ? 'text-[#00a2ed]' : 'text-rose-600'} text-xl font-black mt-0.5 tracking-tight`} numberOfLines={1}>
            ₹{Math.round(exchanger.balance || 0).toLocaleString('en-IN')}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center gap-1.5">
        <TouchableOpacity 
          onPress={() => openAdjust(exchanger)}
          className="w-8 h-8 rounded-[8px] border-2 border-slate-500 bg-white items-center justify-center"
        >
          <FileText color="#475569" size={14} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => deleteExchanger(exchanger.id)} 
          className="w-8 h-8 rounded-[8px] border-2 border-rose-400 bg-white items-center justify-center"
        >
          <Trash2 color="#e11d48" size={14} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function MoneyStac() {
  const [exchangers, setExchangers] = useState<Exchanger[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Daily Allowance / Budget
  const [dailyBudget, setDailyBudget] = useState('350');
  const [inputBudget, setInputBudget] = useState('350');

  // Analytics Calendar State
  const [selectedMonth, setSelectedMonth] = useState(new Date(2026, 8, 1)); // September 2026
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('0');

  const [activeExchanger, setActiveExchanger] = useState<Exchanger | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustAudioUri, setAdjustAudioUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Split Money Modal
  const [divideModalVisible, setDivideModalVisible] = useState(false);
  const [divideAmount, setDivideAmount] = useState('');
  const [divideNote, setDivideNote] = useState('');
  const [includeMyself, setIncludeMyself] = useState(true);
  const [selectedExchangers, setSelectedExchangers] = useState<string[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);

  // Audio configuration for Adjust Modal
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

  // Hardware back button handler for Android
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const onBackPress = () => {
      if (showFullHistory) {
        setShowFullHistory(false);
        return true;
      }
      if (showAnalytics) {
        setShowAnalytics(false);
        return true;
      }
      if (modalVisible) {
        setModalVisible(false);
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
  }, [showFullHistory, showAnalytics, modalVisible, adjustModalVisible, divideModalVisible]);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const saved = await AsyncStorage.getItem('exchangers');
        const savedBudget = await AsyncStorage.getItem('dailyBudget');
        const savedViewMode = await AsyncStorage.getItem('viewMode');

        if (savedBudget && isMounted) {
          setDailyBudget(savedBudget);
          setInputBudget(savedBudget);
        }
        if (savedViewMode && (savedViewMode === 'grid' || savedViewMode === 'list') && isMounted) {
          setViewMode(savedViewMode);
        }

        const DATA_BENCHMARK_SYNC_KEY = 'v4_sept_benchmark_today_workable';
        const benchmarkSynced = await AsyncStorage.getItem(DATA_BENCHMARK_SYNC_KEY);

        if (!benchmarkSynced) {
          await AsyncStorage.setItem('exchangers', JSON.stringify(INITIAL_EXCHANGERS));
          await AsyncStorage.setItem(DATA_BENCHMARK_SYNC_KEY, 'true');
          if (isMounted) {
            setExchangers(INITIAL_EXCHANGERS);
            setIsLoaded(true);
          }
          return;
        }

        let parsed = [];
        if (saved) {
          try {
            parsed = JSON.parse(saved);
          } catch (pe) {
            console.error('Parse error:', pe);
          }
        }
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasMyself = parsed.some(e => e.id === MYSELF_ID);
          if (!hasMyself) {
            parsed.unshift({ id: MYSELF_ID, name: 'MYSELF', balance: 0, history: [] });
          }
          const cleaned = parsed.map(e => ({
            ...e,
            balance: Math.round(e.balance || 0)
          }));
          if (isMounted) setExchangers(cleaned);
        } else if (isMounted) {
          setExchangers(INITIAL_EXCHANGERS);
        }
        setIsLoaded(true);
      } catch (e) {
        console.error('Failed to load data:', e);
        if (isMounted) {
          setExchangers(INITIAL_EXCHANGERS);
          setIsLoaded(true);
        }
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Auto-save exchangers
  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem('exchangers', JSON.stringify(exchangers)).catch(err => {
        console.error('Failed to save data:', err);
      });
    }
  }, [exchangers, isLoaded]);

  // Toggle and save viewMode
  const toggleViewMode = () => {
    const next = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(next);
    AsyncStorage.setItem('viewMode', next).catch(() => {});
  };

  // Save budget
  const saveDailyBudget = (amt: string) => {
    const clean = amt.replace(/[^0-9.]/g, '').trim();
    if (!clean) return;
    setDailyBudget(clean);
    setInputBudget(clean);
    AsyncStorage.setItem('dailyBudget', clean).catch(() => {});
    Alert.alert('Budget Saved', `Daily allowance updated to ₹${clean} / day`);
  };

  const addExchanger = () => {
    if (!newName.trim()) return Alert.alert('Error', 'Please enter a name');
    
    const nameExists = exchangers.some(e => e.name.toLowerCase().trim() === newName.toLowerCase().trim());
    if (nameExists) {
      return Alert.alert('Name Taken', 'This stack name already exists. Please choose a different name.');
    }

    const updated: Exchanger[] = [
      ...exchangers,
      { id: generateId(), name: newName.trim().toUpperCase(), balance: parseFloat(newBalance) || 0, note: '', pinned: false }
    ];
    setExchangers(updated);
    setNewName('');
    setNewBalance('0');
    setModalVisible(false);
  };

  const openAdjust = (exchanger: Exchanger) => {
    setActiveExchanger(exchanger);
    setAdjustAmount('');
    setAdjustNote('');
    setAdjustAudioUri(null);
    setAdjustModalVisible(true);
  };

  const commitAdjustment = (isAdd: boolean) => {
    if (!activeExchanger) return;
    const amount = parseFloat(adjustAmount) || 0;
    const delta = isAdd ? amount : -amount;
    
    const hasDetails = adjustNote.trim().length > 0 || !!adjustAudioUri;

    if (!hasDetails) {
      Alert.alert('Note Required', 'Please add a note or voice note to describe this adjustment.');
      return;
    }
    
    const newTx: Transaction = {
      id: generateId(),
      delta,
      date: new Date().toISOString(),
      note: adjustNote.trim() || undefined,
      audioUri: adjustAudioUri || undefined,
      exchangerId: activeExchanger.id,
      exchangerName: activeExchanger.name
    };
    
    const updated = exchangers.map(e => {
      if (e.id === activeExchanger.id) {
        const pastHistory = e.history || [];
        const newHistory = hasDetails ? [newTx, ...pastHistory] : pastHistory;
        
        return { 
          ...e, 
          balance: e.balance + delta, 
          note: hasDetails ? adjustNote.trim() : e.note, 
          audioUri: adjustAudioUri ? adjustAudioUri : (hasDetails ? undefined : e.audioUri),
          history: newHistory
        };
      } else if (e.id === MYSELF_ID && activeExchanger.id !== MYSELF_ID && isAdd) {
        const myselfDelta = -amount;
        const myselfNote = `To ${activeExchanger.name}${adjustNote.trim() ? ': ' + adjustNote.trim() : ''}`;
        
        const myselfTx: Transaction = {
          id: generateId(),
          delta: myselfDelta,
          date: new Date().toISOString(),
          note: myselfNote,
          audioUri: adjustAudioUri || undefined,
          exchangerId: activeExchanger.id,
          exchangerName: activeExchanger.name
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

  const commitPaidDebt = () => {
    if (!activeExchanger) return;
    const amount = Math.round(parseFloat(adjustAmount) || 0);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Enter Amount', 'Please enter a valid amount to decrease from total debt.');
      return;
    }

    const currentBalance = Math.round(activeExchanger.balance || 0);
    if (currentBalance === 0) {
      Alert.alert('No Debt', 'This stack currently has a ₹0 balance.');
      return;
    }

    const delta = currentBalance > 0 ? -amount : amount;
    const noteText = adjustNote.trim();
    const finalNote = noteText ? `Paid Debt: ${noteText}` : 'Paid Debt';

    const newTx: Transaction = {
      id: generateId(),
      delta,
      date: new Date().toISOString(),
      note: finalNote,
      audioUri: adjustAudioUri || undefined,
      exchangerId: activeExchanger.id,
      exchangerName: activeExchanger.name
    };

    const updated = exchangers.map(e => {
      if (e.id === activeExchanger.id) {
        const pastHistory = e.history || [];
        return {
          ...e,
          balance: Math.round(e.balance + delta),
          note: finalNote,
          audioUri: adjustAudioUri ? adjustAudioUri : undefined,
          history: [newTx, ...pastHistory]
        };
      }
      return e;
    });

    setExchangers(updated);
    setAdjustModalVisible(false);
    setActiveExchanger(null);
    setAdjustNote('');
    setAdjustAmount('');
    setAdjustAudioUri(null);
    setIsRecording(false);
  };

  const promptResetBalance = (exchanger: Exchanger) => {
    if ((exchanger.history || []).length === 0 && (exchanger.balance || 0) === 0) {
      return Alert.alert('Already Clear', 'There are no transactions to clear.');
    }
    
    Alert.alert(
      'Clear All Transactions', 
      `Are you sure you want to clear active balance for ${exchanger.name}? This will set balance to ₹0.`, 
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

  const deleteTransaction = (txId: string) => {
    if (!activeExchanger) return;
    
    const targetTx = (activeExchanger.history || []).find(t => t.id === txId);
    Alert.alert(
      '⚠️ Warning: Delete Transaction',
      `Are you sure you want to permanently delete this transaction${targetTx?.note ? ` ("${targetTx.note}")` : ''} of ₹${Math.abs(targetTx?.delta || 0).toLocaleString('en-IN')}?\n\nThis will adjust the stack balance and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = exchangers.map(e => {
              if (e.id === activeExchanger.id) {
                const txToDelete = (e.history || []).find(t => t.id === txId);
                const balanceAdjustment = txToDelete && !txToDelete.completed ? -txToDelete.delta : 0;
                const newHistory = (e.history || []).filter(t => t.id !== txId);
                return {
                  ...e,
                  balance: e.balance + balanceAdjustment,
                  history: newHistory
                };
              }
              return e;
            });
            setExchangers(updated);
            const updatedExchanger = updated.find(e => e.id === activeExchanger.id);
            if (updatedExchanger) {
              setActiveExchanger(updatedExchanger);
            }
          }
        }
      ]
    );
  };

  const promptClearAllHistory = (exchanger: Exchanger) => {
    if ((exchanger.history || []).length === 0) {
      return Alert.alert('No History', 'There are no transactions to delete.');
    }

    Alert.alert(
      '⚠️ Warning: Delete All History',
      `Are you sure you want to permanently delete all ${(exchanger.history || []).length} transactions for ${exchanger.name}?\n\nThis will reset the transaction history and set the balance to ₹0. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All History',
          style: 'destructive',
          onPress: () => {
            const updated = exchangers.map(e => {
              if (e.id === exchanger.id) {
                return {
                  ...e,
                  balance: 0,
                  note: '',
                  history: []
                };
              }
              return e;
            });
            setExchangers(updated);
            const updatedExchanger = updated.find(e => e.id === exchanger.id);
            if (updatedExchanger) {
              setActiveExchanger(updatedExchanger);
            }
          }
        }
      ]
    );
  };

  const handleHistoryLongPress = (tx: Transaction) => {
    Alert.alert(
      'Transaction Options',
      `${tx.note ? `"${tx.note}"\n` : ''}Amount: ₹${Math.abs(tx.delta).toLocaleString('en-IN')}`,
      [
        {
          text: tx.completed ? 'Mark as Incomplete' : 'Mark as Complete',
          onPress: () => toggleTransactionComplete(tx.id)
        },
        {
          text: 'Delete Transaction',
          style: 'destructive',
          onPress: () => deleteTransaction(tx.id)
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const getTxDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      return `${day} ${month}`;
    } catch {
      return 'RECENT';
    }
  };

  const getTxDirectionLabel = (tx: Transaction, currentExchanger: Exchanger | null) => {
    if (!currentExchanger) return '';
    if (currentExchanger.id === MYSELF_ID) {
      return tx.delta < 0 ? 'ME ➔' : '➔ ME';
    }
    return tx.delta < 0 ? `${currentExchanger.name} ➔ ME` : `ME ➔ ${currentExchanger.name}`;
  };

  // Full transaction history sorted newest first
  const fullHistoryList = useMemo(() => {
    if (!activeExchanger?.history) return [];
    return [...activeExchanger.history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeExchanger?.history]);

  const getDayKey = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return dateStr;
    }
  };

  const dayIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let counter = 0;
    fullHistoryList.forEach(tx => {
      const key = getDayKey(tx.date);
      if (!map.has(key)) {
        map.set(key, counter++);
      }
    });
    return map;
  }, [fullHistoryList]);

  const commitDivide = (isAdd: boolean) => {
    const totalAmount = parseFloat(divideAmount) || 0;
    if (totalAmount <= 0) return Alert.alert('Invalid', 'Enter a valid amount to divide');
    if (selectedExchangers.length === 0 && !includeMyself) return Alert.alert('Selection Empty', 'Select at least one exchanger or yourself');
    
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
      return Alert.alert('Restricted', 'The default "MYSELF" stack is permanent and cannot be deleted.');
    }
    const target = exchangers.find(e => e.id === id);
    const targetName = target ? target.name : 'this exchanger';
    Alert.alert(
      '⚠️ Warning: Delete Stack',
      `Are you sure you want to permanently delete "${targetName}" and all associated records?\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Stack', 
          style: 'destructive', 
          onPress: () => {
            const updated = exchangers.filter(e => e.id !== id);
            setExchangers(updated);
            if (activeExchanger?.id === id) {
              setAdjustModalVisible(false);
              setShowFullHistory(false);
              setActiveExchanger(null);
            }
          }
        }
      ]
    );
  };

  const togglePinExchanger = (id: string) => {
    if (id === MYSELF_ID) return;
    const updated = exchangers.map(e => {
      if (e.id === id) {
        return { ...e, pinned: !e.pinned };
      }
      return e;
    });
    setExchangers(updated);
    if (activeExchanger?.id === id) {
      setActiveExchanger(prev => prev ? { ...prev, pinned: !prev.pinned } : null);
    }
  };



  // Calculations for Portfolio Net
  const myself = exchangers.find(e => e.id === MYSELF_ID);
  const myselfBalance = myself ? (myself.balance || 0) : 0;
  const othersSum = exchangers
    .filter(e => e.id !== MYSELF_ID)
    .reduce((sum, e) => sum + (e.balance || 0), 0);
  const totalNet = myselfBalance - othersSum;

  // Analytics Helpers & Calculations
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  // Aggregate all transactions across exchangers for selected month
  const allMonthlyTransactions = useMemo(() => {
    const list: Transaction[] = [];
    exchangers.forEach(ex => {
      (ex.history || []).forEach(tx => {
        try {
          const d = new Date(tx.date);
          if (d.getFullYear() === year && d.getMonth() === month) {
            list.push({
              ...tx,
              exchangerName: ex.name,
              exchangerId: ex.id
            });
          }
        } catch {}
      });
    });
    return list;
  }, [exchangers, year, month]);

  // Outflow map per day
  const dailyOutflowMap = useMemo(() => {
    const map: Record<number, number> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      map[i] = 0;
    }

    allMonthlyTransactions.forEach(tx => {
      const day = new Date(tx.date).getDate();
      if (tx.delta < 0) {
        map[day] = (map[day] || 0) + Math.abs(tx.delta);
      }
    });

    return map;
  }, [allMonthlyTransactions, daysInMonth]);

  // Total month outflow and active days count
  const monthOutflow = useMemo(() => {
    return Object.values(dailyOutflowMap).reduce((sum, val) => sum + val, 0);
  }, [dailyOutflowMap]);

  const activeDaysCount = useMemo(() => {
    return Object.values(dailyOutflowMap).filter(val => val > 0).length;
  }, [dailyOutflowMap]);

  // Real Today Detection
  const realNow = new Date();
  const isSelectedMonthCurrent = selectedMonth.getFullYear() === realNow.getFullYear() && selectedMonth.getMonth() === realNow.getMonth();
  const todayDateNum = realNow.getDate();

  // Active focus day:
  // - If user selected a specific day, focus on that selected day.
  // - Otherwise, if viewing the current month, focus on real today.
  // - Otherwise, default to day 1 of the selected month.
  const activeFocusDay = selectedDay !== null 
    ? selectedDay 
    : (isSelectedMonthCurrent ? todayDateNum : 1);
  const isFocusingToday = isSelectedMonthCurrent && (selectedDay === null || selectedDay === todayDateNum);

  const todayBudgetNum = parseFloat(dailyBudget) || 350;
  const activeDaySpent = dailyOutflowMap[activeFocusDay] || 0;
  const activeDayTxCount = allMonthlyTransactions.filter(tx => new Date(tx.date).getDate() === activeFocusDay && tx.delta < 0).length;
  const remainingBudget = Math.max(0, todayBudgetNum - activeDaySpent);
  const percentUsed = todayBudgetNum > 0 ? Math.min(100, Math.round((activeDaySpent / todayBudgetNum) * 100)) : 0;
  const isOverBudget = activeDaySpent > todayBudgetNum;

  // Transactions on active focused day (Today or selected day)
  const activeFocusDayTransactions = useMemo(() => {
    return allMonthlyTransactions
      .filter(tx => new Date(tx.date).getDate() === activeFocusDay)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allMonthlyTransactions, activeFocusDay]);

  // Benchmark August totals & difference
  const augTotal = useMemo(() => {
    return Object.values(AUG_BENCHMARK).reduce((s, v) => s + v, 0);
  }, []);
  const diffPercent = useMemo(() => {
    if (augTotal <= 0) return 0;
    return Math.round(((monthOutflow - augTotal) / augTotal) * 100);
  }, [monthOutflow, augTotal]);
  const isOutflowLower = diffPercent <= 0;

  // Bar height helper: 200 vs 300 easily decipherable (40% vs 60%), and >= 500 has fixed height touching the roof (100%)
  const getChartBarHeight = (amount: number) => {
    if (amount <= 0) return 0;
    if (amount >= 500) return 100; // Fixed height touching the roof for anything 500 and above
    return Math.max(5, (amount / 500) * 100);
  };

  // Reset to reference demo data
  const resetToDemoData = () => {
    Alert.alert(
      'Load Reference Data',
      'Replace current records with the 17 benchmark September transactions (total ₹13,732.59)?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load Reference Data',
          onPress: () => {
            setExchangers(INITIAL_EXCHANGERS);
            AsyncStorage.setItem('exchangers', JSON.stringify(INITIAL_EXCHANGERS)).catch(() => {});
            setSelectedDay(null);
          }
        }
      ]
    );
  };

  const handlePrevMonth = () => {
    setSelectedMonth(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setSelectedMonth(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const handleGoToday = () => {
    const d = new Date();
    setSelectedMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(null); // Resets to real Today
  };

  // Format amount for calendar cell
  const formatCellAmount = (amt: number) => {
    if (amt <= 0) return '-';
    if (amt >= 1000) {
      return `₹${(amt / 1000).toFixed(1)}k`;
    }
    return `₹${Math.round(amt)}`;
  };

  // Format full date label
  const getFullDateLabel = (dayNum: number) => {
    try {
      const d = new Date(year, month, dayNum);
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthStr = d.toLocaleDateString('en-US', { month: 'short' });
      return `${weekday}, ${dayNum} ${monthStr}, ${year}`;
    } catch {
      return `${dayNum} Sept, ${year}`;
    }
  };

  // Format transaction time
  const getFormattedTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    } catch {
      return '1:09 pm';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white relative">
      <StatusBar style="dark" />

      {/* RENDER EXPENDITURE ANALYSIS SCREEN (Matching Latest Image) */}
      {showAnalytics ? (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-2"
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* Header Navigation */}
          <View className="flex-row items-center justify-between my-2.5">
            <TouchableOpacity 
              onPress={() => setShowAnalytics(false)}
              className="w-11 h-11 rounded-[10px] bg-white border-2 border-slate-300 items-center justify-center shadow-xs"
            >
              <ArrowLeft color="#1e293b" size={20} strokeWidth={2.5} />
            </TouchableOpacity>

            <View className="items-center">
              <Text className="text-slate-400 text-[10.5px] font-bold uppercase tracking-[3px] mb-0.5">
                MONTHLY ANALYTICS
              </Text>
              <Text className="text-slate-900 text-2xl font-black tracking-tight">
                Expenditure Analysis
              </Text>
            </View>

            <TouchableOpacity 
              onPress={resetToDemoData}
              className="w-11 h-11 rounded-[10px] bg-white border-2 border-slate-300 items-center justify-center shadow-xs"
            >
              <RotateCcw color="#64748b" size={17} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Top horizontal divider line matching screenshot */}
          <View className="h-[1.5px] bg-slate-200 mb-4 -mx-4" />

          {/* CARD 1: TODAY'S EXPENDITURE */}
          <View 
            style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22 }} 
            className="bg-white border-2 border-slate-300 rounded-[14px] mb-4 shadow-xs"
          >
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center flex-1 mr-2">
                <View className="w-12 h-12 rounded-[10px] bg-sky-50/50 border-2 border-sky-300 items-center justify-center mr-3">
                  <Target color="#00a2ed" size={24} strokeWidth={2.2} />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-[2px] mb-0.5" numberOfLines={1}>
                    {isFocusingToday ? "TODAY'S EXPENDITURE" : `DAY ${activeFocusDay} EXPENDITURE`}
                  </Text>
                  <Text className="text-slate-900 text-2xl font-black" numberOfLines={1}>
                    ₹{activeDaySpent.toLocaleString('en-IN')}{' '}
                    <Text className="text-slate-400 font-bold text-sm">
                      / ₹{todayBudgetNum}
                    </Text>
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                <View className={`${isOverBudget ? 'bg-rose-50 border-rose-400' : 'bg-emerald-50 border-emerald-400'} border-2 px-3 py-1.5 rounded-[8px] flex-row items-center gap-1.5`}>
                  {!isOverBudget && <Check color="#059669" size={13} strokeWidth={3} />}
                  <Text className={`${isOverBudget ? 'text-rose-600' : 'text-emerald-600'} font-black text-xs uppercase tracking-wider`}>
                    {isOverBudget ? `₹${(activeDaySpent - todayBudgetNum).toLocaleString('en-IN')} OVER` : `₹${remainingBudget.toLocaleString('en-IN')} LEFT`}
                  </Text>
                </View>

                {/* Quick Add Expense button for today */}
                <TouchableOpacity
                  onPress={() => {
                    const myself = exchangers.find(e => e.id === MYSELF_ID || e.name === 'MYSELF') || exchangers[0];
                    if (myself) openAdjust(myself);
                  }}
                  className="w-9 h-9 rounded-[8px] bg-[#00a2ed] items-center justify-center shadow-xs active:opacity-80"
                  accessibilityLabel="Add Expense"
                >
                  <Plus color="#ffffff" size={18} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Progress Bar Track */}
            <View className="w-full h-4 bg-slate-100 border border-slate-200 rounded-full p-[2px] my-3 overflow-hidden justify-center">
              <View 
                style={{ width: `${Math.min(100, Math.max(percentUsed > 0 ? 5 : 0, percentUsed))}%` }} 
                className={`h-full rounded-full ${isOverBudget ? 'bg-rose-500' : 'bg-[#00a2ed]'}`} 
              />
            </View>

            {/* Stats Bottom Row */}
            <View className="flex-row justify-between items-center mt-3">
              <Text className="text-slate-500 font-bold text-xs">
                {percentUsed}% used • {activeDayTxCount} txs
              </Text>
              <Text className={`${isOverBudget ? 'text-rose-600' : 'text-emerald-600'} font-bold text-xs`}>
                {isOverBudget 
                  ? `Over budget by ₹${(activeDaySpent - todayBudgetNum).toLocaleString('en-IN')}` 
                  : `Can spend ₹${remainingBudget.toLocaleString('en-IN')} more ${isFocusingToday ? 'today' : 'this day'}`}
              </Text>
            </View>
          </View>

          {/* CARD 2: DAILY OUTFLOW COMPARISON */}
          <View 
            style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22 }} 
            className="bg-white border-2 border-slate-300 rounded-[14px] mb-4 shadow-xs"
          >
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-[2px] mb-0.5">
                  DAILY OUTFLOW COMPARISON
                </Text>
                <Text className="text-slate-900 text-base font-black">
                  Sept vs Aug
                </Text>
              </View>

              <View className={`${isOutflowLower ? 'bg-emerald-50 border-emerald-400' : 'bg-rose-50 border-rose-400'} border-2 px-2.5 py-1 rounded-[8px] flex-row items-center gap-1`}>
                {isOutflowLower ? (
                  <TrendingDown color="#059669" size={13} strokeWidth={3} />
                ) : (
                  <TrendingUp color="#e11d48" size={13} strokeWidth={3} />
                )}
                <Text className={`${isOutflowLower ? 'text-emerald-600' : 'text-rose-600'} font-black text-xs uppercase tracking-wider`}>
                  {isOutflowLower ? `${diffPercent}% VS AUG` : `+${diffPercent}% VS AUG`}
                </Text>
              </View>
            </View>

            {/* Horizontal divider inside Card 2 matching screenshot */}
            <View className="h-[1.5px] bg-slate-200 my-3" />

            {/* Legend Box */}
            <View className="border-2 border-slate-300 bg-white rounded-[10px] p-2.5 px-4 mb-3.5 flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <View className="w-3.5 h-3.5 rounded-full bg-[#c084fc]/50 mr-0.5" />
                <Text className="text-[#7e22ce] font-black text-xs">Aug: ₹15,365.83</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="w-3.5 h-3.5 rounded-full bg-[#00a2ed] mr-0.5" />
                <Text className="text-[#00a2ed] font-black text-xs">
                  Sept: ₹{monthOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            {/* Comparison Bar Chart: Overlapped Bars (Semi-transparent Purple behind, Sky Blue in front) */}
            <View className="h-36 relative justify-end mb-2">
              {/* Dotted Threshold Line */}
              <View className="absolute left-0 right-0 top-1/2 border-b border-dashed border-slate-300 z-0" />

              {/* Day Columns */}
              <View className="flex-row items-end justify-between px-0.5 z-10 h-full">
                {Array.from({ length: 31 }).map((_, idx) => {
                  const day = idx + 1;
                  const currentOutflow = dailyOutflowMap[day] || 0;
                  const prevOutflow = AUG_BENCHMARK[day] || 0;

                  const currentHeight = getChartBarHeight(currentOutflow);
                  const prevHeight = getChartBarHeight(prevOutflow);

                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => setSelectedDay(day === selectedDay ? null : day)}
                      className="flex-1 items-center justify-end h-full mx-[0.5px] relative"
                    >
                      {/* Previous Month (Aug) Purple Bar - semi-transparent in the background */}
                      {prevHeight > 0 && (
                        <View 
                          style={{ 
                            height: `${prevHeight}%`, 
                            backgroundColor: 'rgba(192, 132, 252, 0.45)',
                            width: '80%',
                            maxWidth: 7,
                            borderTopLeftRadius: 3,
                            borderTopRightRadius: 3,
                            position: 'absolute',
                            bottom: 0,
                          }} 
                        />
                      )}

                      {/* Current Month (Sept) Sky Blue Bar - overlapping in front */}
                      {currentHeight > 0 && (
                        <View 
                          style={{ 
                            height: `${currentHeight}%`, 
                            backgroundColor: '#00a2ed',
                            width: '60%',
                            maxWidth: 5,
                            borderTopLeftRadius: 2.5,
                            borderTopRightRadius: 2.5,
                            position: 'absolute',
                            bottom: 0,
                            zIndex: 10,
                          }} 
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* X-axis labels */}
            <View className="flex-row justify-between border-t border-slate-200 pt-2 px-1">
              <Text className="text-slate-400 text-[10px] font-bold">Day 1</Text>
              <Text className="text-slate-400 text-[10px] font-bold">Day 5</Text>
              <Text className="text-slate-400 text-[10px] font-bold">Day 10</Text>
              <Text className="text-slate-400 text-[10px] font-bold">Day 15</Text>
              <Text className="text-slate-400 text-[10px] font-bold">Day 20</Text>
              <Text className="text-slate-400 text-[10px] font-bold">Day 25</Text>
              <Text className="text-slate-400 text-[10px] font-bold">Day 31</Text>
            </View>
          </View>

          {/* CARD 3: Month Selector & Calendar Card */}
          <View 
            style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 22 }} 
            className="bg-white border-2 border-slate-300 rounded-[14px] mb-4 shadow-xs"
          >
            {/* Top Month Controls */}
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <TouchableOpacity 
                  onPress={handlePrevMonth} 
                  className="w-10 h-10 rounded-[10px] border-2 border-slate-400 bg-white items-center justify-center"
                >
                  <ChevronLeft color="#1e293b" size={18} strokeWidth={2.5} />
                </TouchableOpacity>

                <Text className="text-slate-900 font-black text-base mx-2 tracking-tight">
                  {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>

                <TouchableOpacity 
                  onPress={handleNextMonth} 
                  className="w-10 h-10 rounded-[10px] border-2 border-slate-400 bg-white items-center justify-center"
                >
                  <ChevronRight color="#1e293b" size={18} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                onPress={handleGoToday}
                className="border-2 border-sky-400 bg-white px-4 py-2 rounded-[8px] shadow-xs"
              >
                <Text className="text-[#00a2ed] font-black text-xs uppercase tracking-wider">
                  TODAY
                </Text>
              </TouchableOpacity>
            </View>

            {/* Outflow Stats Summary */}
            <View className="flex-row justify-between items-center mb-3 pb-2.5 border-b border-slate-200">
              <Text className="text-slate-400 text-[10.5px] font-bold uppercase tracking-wider">
                MONTH OUTFLOW: <Text className="text-slate-900 font-black">₹{monthOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </Text>
              <Text className="text-slate-400 text-xs font-bold">
                {activeDaysCount} active days
              </Text>
            </View>

            {/* Day of Week Headers */}
            <View className="flex-row justify-between mb-2 px-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, index) => (
                <View key={index} className="flex-1 items-center">
                  <Text className="text-slate-400 text-xs font-bold italic">{d}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid with Fixed-Size Square Cells */}
            <View className="flex-row flex-wrap">
              {/* Offset days for start of month - square */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <View key={`empty-${idx}`} className="w-[14.28%] p-[2.5px]">
                  <View style={{ aspectRatio: 1 }} className="w-full" />
                </View>
              ))}

              {/* Day Cells - Perfectly Square */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const outflow = dailyOutflowMap[day] || 0;
                const hasExpense = outflow > 0;
                const isSelectedCell = selectedDay === day;
                const isTodayCell = isSelectedMonthCurrent && todayDateNum === day;
                const isFocus = selectedDay !== null ? isSelectedCell : isTodayCell;

                let cellBg = 'bg-white';
                let cellBorder = 'border-slate-200';
                let numColor = 'text-slate-400';
                let amtColor = 'text-slate-300';

                if (isFocus) {
                  cellBg = isTodayCell && selectedDay === null ? 'bg-sky-50/40' : 'bg-white';
                  cellBorder = 'border-2 border-[#00a2ed]';
                  numColor = 'text-slate-900';
                  amtColor = hasExpense ? 'text-[#00a2ed]' : 'text-slate-400';
                } else if (hasExpense) {
                  cellBg = 'bg-white';
                  cellBorder = 'border-2 border-rose-300';
                  numColor = 'text-slate-900';
                  amtColor = 'text-rose-600';
                }

                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => setSelectedDay(day === selectedDay ? null : day)}
                    className="w-[14.28%] p-[2.5px]"
                  >
                    <View 
                      style={{ aspectRatio: 1 }}
                      className={`w-full rounded-[10px] border-2 ${cellBorder} ${cellBg} justify-between items-center py-1.5 px-0.5`}
                    >
                      <Text className={`font-black text-xs ${numColor}`} numberOfLines={1}>
                        {day}
                      </Text>
                      <Text className={`font-bold text-[8px] ${amtColor}`} numberOfLines={1}>
                        {formatCellAmount(outflow)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* CARD 4: Focused Day Detail Card (Today by default or selected day) */}
          <View className="bg-white border-2 border-slate-300 rounded-[14px] p-4 mb-4 shadow-xs">
            <View className="flex-row justify-between items-center mb-3 pb-2 border-b-2 border-slate-200">
              <View className="flex-row items-center gap-2">
                <CalendarIcon color="#00a2ed" size={18} strokeWidth={2.5} />
                <View>
                  <Text className="text-slate-900 font-black text-sm">
                    {getFullDateLabel(activeFocusDay)}
                  </Text>
                  {isFocusingToday && (
                    <Text className="text-[#00a2ed] text-[10px] font-black tracking-wider uppercase">
                      TODAY
                    </Text>
                  )}
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                <View className={`${activeDaySpent > 0 ? 'bg-rose-50 border-rose-400' : 'bg-slate-50 border-slate-300'} border-2 px-2.5 py-1 rounded-[8px]`}>
                  <Text className={`${activeDaySpent > 0 ? 'text-rose-600' : 'text-slate-600'} font-black text-xs`}>
                    ₹{activeDaySpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                {/* Quick Add Button */}
                <TouchableOpacity 
                  onPress={() => {
                    const myself = exchangers.find(e => e.id === MYSELF_ID || e.name === 'MYSELF') || exchangers[0];
                    if (myself) openAdjust(myself);
                  }}
                  className="px-2.5 py-1 rounded-[8px] bg-[#00a2ed] flex-row items-center gap-1 shadow-xs active:opacity-80"
                  accessibilityLabel="Add Expense"
                >
                  <Plus color="#ffffff" size={13} strokeWidth={3} />
                  <Text className="text-white font-black text-xs">ADD</Text>
                </TouchableOpacity>

                {selectedDay !== null && (
                  <TouchableOpacity 
                    onPress={() => setSelectedDay(null)}
                    className="w-7 h-7 rounded-[8px] border-2 border-slate-400 bg-white items-center justify-center"
                    accessibilityLabel="Reset to Today"
                  >
                    <X color="#334155" size={14} strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {activeFocusDayTransactions.length > 0 ? (
              activeFocusDayTransactions.map(tx => (
                <View 
                  key={tx.id} 
                  className="border-2 border-slate-300 rounded-[10px] p-3 mb-2 bg-white shadow-xs"
                >
                  <View className="flex-row justify-between items-center mb-1">
                    <View className="flex-row items-center gap-2.5">
                      <View className="w-9 h-9 rounded-[10px] bg-purple-50 border-2 border-purple-400 items-center justify-center">
                        <User color="#9333ea" size={18} strokeWidth={2} />
                      </View>
                      <View>
                        <Text className="text-purple-700 font-black text-xs uppercase tracking-wider">
                          {tx.exchangerName || 'MYSELF'}
                        </Text>
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <Clock color="#64748b" size={10} />
                          <Text className="text-slate-500 text-[10px] font-bold">
                            {getFormattedTime(tx.date)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text className={`${tx.delta < 0 ? 'text-rose-600' : 'text-emerald-600'} font-black text-base`}>
                      {tx.delta < 0 ? `- ₹${Math.abs(tx.delta).toLocaleString('en-IN')}` : `+ ₹${tx.delta.toLocaleString('en-IN')}`}
                    </Text>
                  </View>

                  {tx.note ? (
                    <View className="border-2 border-slate-200 rounded-[8px] p-2 mt-2 bg-slate-50/50">
                      <Text className="text-slate-800 text-xs italic font-medium">
                        &quot;{tx.note}&quot;
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))
            ) : (
              <View className="py-5 items-center justify-center">
                <Text className="text-slate-400 text-xs font-bold mb-2">No expenditures recorded for this day</Text>
                <TouchableOpacity
                  onPress={() => {
                    const myself = exchangers.find(e => e.id === MYSELF_ID || e.name === 'MYSELF') || exchangers[0];
                    if (myself) openAdjust(myself);
                  }}
                  className="border-2 border-dashed border-[#00a2ed] bg-sky-50/40 px-3.5 py-1.5 rounded-[8px] flex-row items-center gap-1.5"
                >
                  <Plus color="#00a2ed" size={14} strokeWidth={2.5} />
                  <Text className="text-[#00a2ed] font-black text-xs">Record Expense</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* CARD 5: Daily Allowance / Set Daily Budget Card */}
          <View className="bg-white border-2 border-slate-400 rounded-[14px] p-4 mb-4 shadow-xs">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center gap-2.5">
                <SlidersHorizontal color="#00a2ed" size={20} strokeWidth={2.5} />
                <View>
                  <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-[2px]">
                    DAILY ALLOWANCE
                  </Text>
                  <Text className="text-slate-900 text-base font-black">
                    Set Daily Budget
                  </Text>
                </View>
              </View>

              <View className="bg-sky-50 border-2 border-[#00a2ed] px-3 py-1 rounded-[8px]">
                <Text className="text-[#00a2ed] font-black text-xs">
                  ₹{dailyBudget} / day
                </Text>
              </View>
            </View>

            <Text className="text-slate-500 text-[9px] font-bold uppercase tracking-[2px] mb-2.5">
              QUICK PRESETS
            </Text>

            {/* Presets Row: border-2 border-slate-400, rounded-[8px] */}
            <View className="flex-row gap-2 mb-3.5">
              {['500', '1000', '2000', '5000'].map((preset) => {
                const label = preset === '1000' ? '₹1k' : preset === '2000' ? '₹2k' : preset === '5000' ? '₹5k' : `₹${preset}`;
                return (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => setInputBudget(preset)}
                    className="flex-1 bg-white border-2 border-slate-400 py-2.5 rounded-[8px] items-center shadow-xs"
                  >
                    <Text className="text-slate-800 font-black text-xs">{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Input + Save Row */}
            <View className="flex-row gap-3">
              <View className="flex-1 bg-white border-2 border-slate-400 rounded-[10px] px-3.5 py-2.5 flex-row items-center">
                <Text className="text-slate-500 font-black text-base mr-2">₹</Text>
                <TextInput
                  value={inputBudget}
                  onChangeText={setInputBudget}
                  keyboardType="numeric"
                  placeholder="350"
                  placeholderTextColor="#94a3b8"
                  className="text-slate-900 font-black text-base flex-1 p-0"
                />
              </View>

              <TouchableOpacity 
                onPress={() => saveDailyBudget(inputBudget)}
                className="bg-[#00a2ed] px-6 rounded-[10px] items-center justify-center shadow-md shadow-sky-500/25"
              >
                <Text className="text-white font-black text-xs uppercase tracking-wider">
                  SAVE
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        /* RENDER MAIN DASHBOARD (EXCHANGERS LIST / GRID) */
        <View className="flex-1 px-4 relative">
          {/* Header Card (Images 3 & 4) */}
          <View className="pt-3 pb-2">
            <View className="bg-white border-2 border-slate-400 rounded-[14px] p-5 shadow-xs overflow-hidden relative">
              <View className="flex-row justify-between items-center z-10">
                <View>
                  <Text className="text-slate-500 text-[11px] font-bold uppercase tracking-[2.5px] mb-1">
                    PORTFOLIO NET
                  </Text>
                  <Text className="text-slate-900 text-3xl font-black tracking-tight">
                    ₹{totalNet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>

                <View className="flex-row items-center gap-3">
                  <TouchableOpacity 
                    onPress={() => setDivideModalVisible(true)}
                    className="w-12 h-12 rounded-[14px] bg-sky-50 border-2 border-sky-400 items-center justify-center shadow-xs"
                  >
                    <PieChart color="#00a2ed" size={21} strokeWidth={2.5} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => setModalVisible(true)}
                    className="w-12 h-12 rounded-[14px] bg-[#00a2ed] items-center justify-center shadow-md shadow-sky-500/25"
                  >
                    <Plus color="white" size={28} strokeWidth={3} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Soft light blue ambient radial glow in top right */}
              <View className="absolute -right-6 -top-6 w-36 h-36 bg-sky-100/50 rounded-full" />
            </View>
          </View>

          {/* Search Bar + View Toggle (Images 3 & 4) */}
          <View className="flex-row items-center gap-2.5 my-2.5">
            <View className="flex-1 h-12 bg-white border-2 border-slate-400 rounded-[14px] px-3.5 flex-row items-center shadow-xs">
              <Search color="#64748b" size={18} strokeWidth={2.5} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search exchanger..."
                placeholderTextColor="#94a3b8"
                className="text-slate-900 font-bold text-sm ml-2.5 flex-1 p-0"
              />
            </View>

            <TouchableOpacity 
              onPress={toggleViewMode}
              className="w-12 h-12 bg-white border-2 border-slate-400 rounded-[14px] items-center justify-center shadow-xs"
            >
              {viewMode === 'grid' ? (
                <ListIcon color="#1e293b" size={19} strokeWidth={2.5} />
              ) : (
                <LayoutGrid color="#1e293b" size={19} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          {/* Exchangers Section Header */}
          <Text className="text-slate-500 text-[11px] font-black uppercase tracking-[3px] mb-2.5 ml-1">
            EXCHANGERS
          </Text>

          {/* Exchangers Scrollable Content */}
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            className="flex-1"
          >
            {viewMode === 'grid' ? (
              <View className="flex-row flex-wrap justify-between">
                {exchangers
                  .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => {
                    if (a.id === MYSELF_ID) return -1;
                    if (b.id === MYSELF_ID) return 1;
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return (b.balance || 0) - (a.balance || 0);
                  })
                  .map((exchanger) => (
                    <ExchangerGridCard 
                      key={exchanger.id} 
                      exchanger={exchanger} 
                      openAdjust={openAdjust} 
                      deleteExchanger={deleteExchanger} 
                      promptResetBalance={promptResetBalance}
                      togglePinExchanger={togglePinExchanger}
                    />
                  ))
                }
              </View>
            ) : (
              <View className="flex-col">
                {exchangers
                  .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => {
                    if (a.id === MYSELF_ID) return -1;
                    if (b.id === MYSELF_ID) return 1;
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return (b.balance || 0) - (a.balance || 0);
                  })
                  .map((exchanger) => (
                    <ExchangerListCard 
                      key={exchanger.id} 
                      exchanger={exchanger} 
                      openAdjust={openAdjust} 
                      deleteExchanger={deleteExchanger} 
                      promptResetBalance={promptResetBalance}
                      togglePinExchanger={togglePinExchanger}
                    />
                  ))
                }
              </View>
            )}

            {exchangers.length === 0 && (
              <View className="w-full mt-20 items-center justify-center">
                <View className="bg-slate-100 p-8 rounded-[14px] border-2 border-slate-400 mb-4">
                  <LayoutGrid color="#64748b" size={40} />
                </View>
                <Text className="text-slate-500 text-center font-bold px-10">
                  Your stack is empty.{'\n'}Tap + to create an exchanger.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Floating ANALYSIS Pill Button (Images 3 & 4) */}
          <TouchableOpacity 
            onPress={() => setShowAnalytics(true)}
            className="absolute bottom-6 right-5 bg-[#00a2ed] flex-row items-center px-4 py-2.5 rounded-[10px] shadow-lg shadow-sky-500/30 gap-1.5 z-40"
          >
            <TrendingUp color="white" size={17} strokeWidth={2.5} />
            <Text className="text-white font-black text-xs tracking-wider">
              ANALYSIS
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* NEW STACK MODAL (White Theme) */}
      {modalVisible && (
        <View className="absolute inset-0 z-50 justify-end bg-slate-900/40">
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="w-full flex-1 justify-end"
          >
            <View className="bg-white rounded-t-[20px] p-6 pb-9 border-t-2 border-slate-400 shadow-2xl">
              <View className="w-12 h-1 bg-slate-400 rounded-full self-center mb-5" />
              <Text className="text-slate-900 text-2xl font-black tracking-tight mb-5">New Stack</Text>
              
              <View className="gap-4">
                <View>
                  <Text className="text-slate-500 text-[10px] mb-2 uppercase tracking-[2px] font-black">Entity Name</Text>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="e.g. Cold Wallet, Bank, Friend"
                    placeholderTextColor="#94a3b8"
                    className="bg-slate-50 text-slate-900 p-3.5 rounded-[10px] border-2 border-slate-400 font-bold text-base"
                  />
                </View>

                <View>
                  <Text className="text-slate-500 text-[10px] mb-2 uppercase tracking-[2px] font-black">Initial Stac</Text>
                  <TextInput
                    value={newBalance}
                    onChangeText={setNewBalance}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                    scrollEnabled={false}
                    multiline={false}
                    className="bg-slate-50 text-slate-900 h-16 px-4 rounded-[10px] border-2 border-slate-400 font-black text-3xl"
                  />
                </View>

                <View className="flex-row gap-3 mt-3">
                  <TouchableOpacity 
                    onPress={() => setModalVisible(false)}
                    className="flex-1 bg-slate-100 py-3 rounded-[10px] items-center border-2 border-slate-400"
                  >
                    <Text className="text-slate-700 font-black tracking-wider uppercase text-xs">Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={addExchanger}
                    className="flex-[2] bg-[#00a2ed] py-3 rounded-[10px] items-center shadow-md shadow-sky-500/25"
                  >
                    <Text className="text-white font-black tracking-wider uppercase text-xs">Create Stac</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ADJUST BALANCE OVERLAY (White Theme) */}
      {adjustModalVisible && (
        <View className="absolute inset-0 z-50 justify-center items-center bg-slate-900/40 px-5">
          <View className="w-full bg-white border-2 border-slate-400 rounded-[16px] p-5 shadow-2xl max-h-[88%]">
            <View className="flex-row justify-between items-start mb-3">
              <View className="flex-1 mr-2">
                <Text className="text-slate-500 text-[10px] uppercase tracking-[2px] font-black">Adjusting</Text>
                <Text className="text-slate-900 text-xl font-black uppercase tracking-tight" numberOfLines={1}>
                  {activeExchanger?.name}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <View className="items-end">
                  <Text className="text-slate-500 text-[10px] uppercase tracking-[2px] font-black">Total</Text>
                  <Text className={`text-xl font-black ${(activeExchanger?.balance || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{Math.abs(activeExchanger?.balance || 0).toLocaleString('en-IN')}
                  </Text>
                </View>

                {activeExchanger && activeExchanger.id !== MYSELF_ID && (
                  <>
                    <TouchableOpacity
                      onPress={() => togglePinExchanger(activeExchanger.id)}
                      className={`w-9 h-9 rounded-[10px] border-2 ${activeExchanger.pinned ? 'bg-sky-50 border-sky-400' : 'bg-white border-slate-300'} items-center justify-center shadow-xs active:bg-slate-100`}
                      accessibilityLabel={activeExchanger.pinned ? 'Unpin stack' : 'Pin stack to top'}
                    >
                      <Pin 
                        color={activeExchanger.pinned ? '#00a2ed' : '#64748b'} 
                        size={15} 
                        strokeWidth={2} 
                        fill={activeExchanger.pinned ? '#00a2ed' : 'transparent'} 
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => deleteExchanger(activeExchanger.id)}
                      className="w-9 h-9 rounded-[10px] bg-rose-50 border-2 border-rose-300 items-center justify-center shadow-xs active:bg-rose-100"
                      accessibilityLabel="Delete Stack"
                    >
                      <Trash2 color="#e11d48" size={15} strokeWidth={2.2} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
            
            <TextInput
              autoFocus
              value={adjustAmount}
              onChangeText={setAdjustAmount}
              keyboardType="numeric"
              placeholder="₹ 0.00"
              placeholderTextColor="#94a3b8"
              multiline={false}
              scrollEnabled={false}
              className="text-slate-900 text-4xl font-black text-center h-14 mb-3"
            />

            <View className="mb-3">
              <View className="flex-row justify-between items-end mb-1.5">
                <Text className="text-slate-500 text-[10px] uppercase tracking-[2px] font-black">Transaction Details</Text>
                
                {adjustAudioUri && !isRecording && (
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity onPress={() => setAdjustAudioUri(null)}>
                      <Text className="text-rose-600 text-[9px] font-black uppercase tracking-widest mr-1">Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => {
                        if (adjustPlayer) {
                          adjustPlayer.seekTo(0);
                          adjustPlayer.play();
                        }
                      }}
                      className="flex-row items-center gap-1 bg-[#00a2ed] px-2 py-1 rounded-[6px]"
                    >
                      <Play color="white" size={10} fill="white" />
                      <Text className="text-white font-black text-[9px] uppercase">Play</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View className="flex-row gap-2">
                <TextInput
                  value={adjustNote}
                  onChangeText={setAdjustNote}
                  placeholder="Note (e.g. Rent, Ice cream...)"
                  placeholderTextColor="#94a3b8"
                  scrollEnabled={false}
                  multiline={false}
                  className="flex-1 bg-slate-50 text-slate-900 p-3 rounded-[10px] border-2 border-slate-400 font-bold text-sm"
                />
                <TouchableOpacity 
                  onPress={isRecording ? stopRecording : startRecording}
                  className={`w-11 h-11 rounded-[10px] items-center justify-center border-2 ${isRecording ? 'bg-rose-500 border-rose-400' : 'bg-slate-100 border-slate-400'}`}
                >
                  {isRecording ? <Square color="white" size={17} /> : <Mic color={adjustAudioUri ? '#10b981' : '#64748b'} size={17} />}
                </TouchableOpacity>
              </View>
            </View>
            
            {activeExchanger?.id === MYSELF_ID ? (
              <View className="flex-row gap-2.5 mb-2">
                <TouchableOpacity 
                  onPress={() => commitAdjustment(false)}
                  className="flex-[2] bg-rose-50 border-2 border-rose-400 py-3 rounded-[10px] items-center justify-center"
                >
                  <Text className="text-rose-600 font-black text-sm uppercase tracking-wider text-center">
                    Me ➔
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => commitAdjustment(true)}
                  className="flex-[1] bg-emerald-50 border-2 border-emerald-400 py-3 rounded-[10px] items-center justify-center"
                >
                  <Text className="text-emerald-600 font-black text-xs uppercase tracking-wider text-center">
                    ➔ Me
                  </Text>
                  <Text className="text-emerald-600 font-bold text-[8px] uppercase tracking-wider text-center">
                    (Add)
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="mb-2">
                <View className="flex-row gap-2.5 mb-2">
                  <TouchableOpacity 
                    onPress={() => commitAdjustment(false)}
                    className="flex-1 bg-rose-50 border-2 border-rose-400 py-3 rounded-[10px] items-center justify-center"
                  >
                    <Text className="text-rose-600 font-black text-xs uppercase tracking-wider text-center" numberOfLines={1}>
                      {activeExchanger?.name} ➔ Me
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => commitAdjustment(true)}
                    className="flex-1 bg-sky-50 border-2 border-sky-400 py-3 rounded-[10px] items-center justify-center active:bg-sky-100"
                  >
                    <Text className="text-[#00a2ed] font-black text-xs uppercase tracking-wider text-center" numberOfLines={1}>
                      Me ➔ {activeExchanger?.name}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  onPress={commitPaidDebt}
                  className="w-full bg-emerald-50 border-2 border-emerald-500 py-2.5 rounded-[10px] items-center justify-center flex-row gap-1.5 active:bg-emerald-100 shadow-2xs"
                >
                  <Check color="#059669" size={14} strokeWidth={2.5} />
                  <Text className="text-emerald-700 font-black text-xs uppercase tracking-wider text-center">
                    Paid Debt (Decrease Total)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* History List */}
            {(activeExchanger?.history || []).length > 0 && (
              <View className="mt-3 mb-1">
                {/* Header Row: RECENT HISTORY on left, VIEW ALL on right */}
                <View className="flex-row justify-between items-center mb-2 px-0.5">
                  <Text className="text-slate-400 text-[10px] uppercase tracking-[2px] font-black">
                    RECENT HISTORY
                  </Text>
                  <TouchableOpacity 
                    onPress={() => setShowFullHistory(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="View All History"
                  >
                    <Text className="text-[#00a2ed] text-[10.5px] font-black uppercase tracking-wider">
                      VIEW ALL
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="max-h-[210px]">
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {fullHistoryList.map(tx => {
                      const dirLabel = getTxDirectionLabel(tx, activeExchanger);
                      const isMyself = activeExchanger?.id === MYSELF_ID;
                      const isMeTo = dirLabel.startsWith('ME ➔');
                      const isAltDay = ((dayIndexMap.get(getDayKey(tx.date)) ?? 0) % 2) === 1;

                      const isSkyBlue = isMeTo && !isMyself;
                      const isMyselfOutflow = isMyself && isMeTo;

                      return (
                        <View 
                          key={tx.id}
                          className={`border-2 ${
                            tx.completed 
                              ? (isAltDay ? 'border-slate-300 opacity-60 bg-slate-200/70' : 'border-slate-200 opacity-60 bg-slate-50/50') 
                              : (isAltDay ? 'border-slate-400 bg-slate-200' : 'border-slate-300 bg-white')
                          } rounded-[14px] p-3.5 mb-2.5 shadow-xs`}
                        >
                          {/* Top Row: Date + Direction on left, Amount on right */}
                          <View className="flex-row justify-between items-center mb-0.5">
                            <Text className={`${isSkyBlue ? 'text-[#00a2ed]' : (isMyselfOutflow ? 'text-rose-600' : 'text-slate-600')} font-black text-xs uppercase tracking-wider`}>
                              {getTxDateLabel(tx.date)}  {dirLabel}
                            </Text>
                            <Text className={`font-black text-sm ${
                              tx.completed 
                                ? 'text-slate-400 line-through' 
                                : isSkyBlue 
                                  ? 'text-[#00a2ed]' 
                                  : (tx.delta >= 0 ? 'text-emerald-600' : 'text-rose-600')
                            }`}>
                              ₹{Math.round(Math.abs(tx.delta)).toLocaleString('en-IN')}
                            </Text>
                          </View>

                        {/* Middle Row: Note in quotes */}
                        {tx.note ? (
                          <Text className="text-slate-800 text-xs font-medium italic my-1">
                            &quot;{tx.note}&quot;
                          </Text>
                        ) : null}

                        {/* Bottom Row: TAP TO COMPLETE on left, Red Trash Button on right */}
                        <View className="flex-row items-center justify-between mt-1 pt-1">
                          <TouchableOpacity 
                            onPress={() => toggleTransactionComplete(tx.id)}
                            onLongPress={() => handleHistoryLongPress(tx)}
                            delayLongPress={400}
                            className="flex-1 mr-2"
                          >
                            <Text className={`font-black text-[10px] uppercase tracking-wider ${tx.completed ? 'text-slate-400' : 'text-[#00a2ed]'}`}>
                              {tx.completed ? '✓ COMPLETED' : 'TAP TO COMPLETE'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => deleteTransaction(tx.id)}
                            className="w-7 h-7 rounded-[8px] bg-rose-50/70 border border-rose-300 items-center justify-center active:bg-rose-100"
                            accessibilityLabel="Delete transaction"
                          >
                            <Trash2 color="#e11d48" size={13} strokeWidth={2} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                  </ScrollView>
                </View>
              </View>
            )}

            <TouchableOpacity 
              onPress={() => {
                setAdjustModalVisible(false);
                setIsRecording(false);
              }}
              className="mt-2 items-center py-1"
            >
              <Text className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SPLIT MONEY MODAL (White Theme) */}
      {divideModalVisible && (
        <View className="absolute inset-0 z-50 justify-end bg-slate-900/40">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="w-full">
            <View className="bg-white border-t-2 border-slate-400 rounded-t-[20px] p-5 pt-5 max-h-[90%] shadow-2xl">
              <View className="mb-3.5">
                <Text className="text-slate-500 text-[10px] uppercase tracking-[2px] font-black">Distribute Funds</Text>
                <Text className="text-slate-900 text-2xl font-black tracking-tight">Split Money</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-3">
                <View className="gap-2.5">
                  <TextInput
                    value={divideAmount}
                    onChangeText={setDivideAmount}
                    keyboardType="numeric"
                    placeholder="Total Amount (₹ 0.00)"
                    placeholderTextColor="#94a3b8"
                    className="bg-slate-50 text-slate-900 p-3.5 rounded-[10px] border-2 border-slate-400 font-black text-2xl text-center"
                  />

                  <TextInput
                    value={divideNote}
                    onChangeText={setDivideNote}
                    placeholder="Note (e.g. Dinner, Rent...)"
                    placeholderTextColor="#94a3b8"
                    className="bg-slate-50 text-slate-900 p-3 rounded-[10px] border-2 border-slate-400 font-bold text-sm"
                  />

                  <TouchableOpacity 
                    onPress={() => setIncludeMyself(!includeMyself)}
                    className={`flex-row items-center justify-between p-3 rounded-[10px] border-2 ${includeMyself ? 'bg-sky-50 border-[#00a2ed]' : 'bg-slate-50 border-slate-400'}`}
                  >
                    <View className="flex-row items-center gap-2">
                      <Users color={includeMyself ? '#00a2ed' : '#64748b'} size={17} />
                      <Text className={`font-black uppercase tracking-wider text-[10px] ${includeMyself ? 'text-[#00a2ed]' : 'text-slate-600'}`}>
                        Include Myself in math
                      </Text>
                    </View>
                    <View className={`w-5 h-5 rounded-[5px] border-2 items-center justify-center ${includeMyself ? 'bg-[#00a2ed] border-[#00a2ed]' : 'border-slate-500'}`}>
                      {includeMyself && <Text className="text-white font-black text-xs">✓</Text>}
                    </View>
                  </TouchableOpacity>

                  <View className="mt-1">
                    <Text className="text-slate-500 text-[10px] uppercase tracking-[2px] font-black mb-1.5 ml-1">Select Exchangers</Text>
                    {exchangers.filter(e => e.id !== MYSELF_ID).map(e => {
                      const isSelected = selectedExchangers.includes(e.id);
                      return (
                        <TouchableOpacity 
                          key={e.id} 
                          onPress={() => toggleSelectExchanger(e.id)}
                          className={`flex-row items-center justify-between p-2.5 rounded-[10px] mb-1.5 border-2 ${isSelected ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-400'}`}
                        >
                          <Text className={`font-bold text-xs ${isSelected ? 'text-emerald-700' : 'text-slate-800'}`}>{e.name}</Text>
                          <View className={`w-5 h-5 rounded-[5px] border-2 items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-500'}`}>
                            {isSelected && <Text className="text-white font-black text-xs">✓</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Math preview */}
                  <View className="bg-sky-50 p-3 rounded-[10px] border-2 border-sky-400 items-center mt-1.5">
                    <Text className="text-slate-500 text-[9px] uppercase tracking-[2px] font-black mb-1">Mathematical Split</Text>
                    <Text className="text-[#00a2ed] text-base font-black">
                      ₹{(parseFloat(divideAmount) || 0).toLocaleString('en-IN')} ÷ {selectedExchangers.length + (includeMyself ? 1 : 0)} = 
                      <Text className="text-slate-900"> ₹{((parseFloat(divideAmount) || 0) / (selectedExchangers.length + (includeMyself ? 1 : 0) || 1)).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})} </Text>
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <View className="flex-row gap-2.5 mb-2">
                <TouchableOpacity 
                  onPress={() => commitDivide(false)}
                  className="flex-1 bg-rose-50 border-2 border-rose-400 py-3 rounded-[10px] items-center"
                >
                  <Minus color="#e11d48" size={17} strokeWidth={3} />
                  <Text className="text-rose-600 font-black text-[9px] uppercase mt-1 tracking-wider">Charge Debt</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={() => commitDivide(true)}
                  className="flex-[1.5] bg-[#00a2ed] py-3 rounded-[10px] items-center shadow-md shadow-sky-500/25"
                >
                  <Plus color="white" size={17} strokeWidth={3} />
                  <Text className="text-white font-black text-[9px] uppercase mt-1 tracking-wider">Deposit Share</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                onPress={() => {
                  setDivideModalVisible(false);
                  setDivideAmount('');
                  setSelectedExchangers([]);
                }}
                className="mt-1.5 items-center py-1"
              >
                <Text className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}



      {/* WHOLE PAGE TRANSACTION HISTORY OVERLAY (Matching screenshot) */}
      {showFullHistory && activeExchanger && (
        <View className="absolute inset-0 z-[60] bg-white">
          <SafeAreaView className="flex-1 bg-white">
            {/* Header matching screenshot */}
            <View className="flex-row justify-between items-start px-5 pt-3 pb-3 border-b-2 border-slate-100">
              <View>
                <Text className="text-slate-400 text-[11px] font-black uppercase tracking-[2.5px] mb-1">
                  TRANSACTION HISTORY
                </Text>
                <Text className="text-slate-900 text-3xl font-black uppercase tracking-tight">
                  {activeExchanger.name}
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <TouchableOpacity 
                  onPress={() => promptClearAllHistory(activeExchanger)}
                  className="h-11 px-3 rounded-[12px] border-2 border-rose-300 bg-rose-50 flex-row items-center gap-1.5 shadow-xs active:bg-rose-100"
                  accessibilityLabel="Clear All History"
                >
                  <Trash2 color="#e11d48" size={16} strokeWidth={2.2} />
                  <Text className="text-rose-600 font-black text-xs uppercase tracking-wider">Clear All</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setShowFullHistory(false)}
                  className="w-11 h-11 rounded-[12px] border-2 border-slate-300 bg-white items-center justify-center shadow-xs active:bg-slate-100"
                  accessibilityLabel="Close History"
                >
                  <X color="#334155" size={20} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Scrollable list of cards matching user screenshot */}
            <ScrollView 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
            >
              {fullHistoryList.length > 0 ? (
                fullHistoryList.map(tx => {
                  const dateLabel = getTxDateLabel(tx.date);
                  const dirLabel = getTxDirectionLabel(tx, activeExchanger);
                  const isMyself = activeExchanger?.id === MYSELF_ID;
                  const isMeTo = dirLabel.startsWith('ME ➔');
                  const isAltDay = ((dayIndexMap.get(getDayKey(tx.date)) ?? 0) % 2) === 1;

                  const isSkyBlue = isMeTo && !isMyself;
                  const isMyselfOutflow = isMyself && isMeTo;

                  return (
                    <TouchableOpacity
                      key={tx.id}
                      onPress={() => toggleTransactionComplete(tx.id)}
                      onLongPress={() => handleHistoryLongPress(tx)}
                      delayLongPress={400}
                      activeOpacity={0.7}
                      className={`border-2 ${
                        tx.completed 
                          ? (isAltDay ? 'border-slate-300 opacity-60 bg-slate-200/70' : 'border-slate-200 opacity-60 bg-slate-50/50') 
                          : (isAltDay ? 'border-slate-400 bg-slate-200' : 'border-slate-300 bg-white')
                      } rounded-[14px] p-4 mb-3.5 shadow-xs`}
                    >
                      {/* Top Row: Date + Direction and Amount */}
                      <View className="flex-row justify-between items-center mb-1">
                        <Text className={`${isSkyBlue ? 'text-[#00a2ed]' : (isMyselfOutflow ? 'text-rose-600' : 'text-slate-700')} font-black text-xs uppercase tracking-wider`}>
                          {dateLabel}  {dirLabel}
                        </Text>
                        <Text className={`font-black text-base ${
                          tx.completed 
                            ? 'text-slate-400 line-through' 
                            : isSkyBlue 
                              ? 'text-[#00a2ed]' 
                              : (tx.delta < 0 ? 'text-[#be123c]' : 'text-[#059669]')
                        }`}>
                          ₹{Math.round(Math.abs(tx.delta)).toLocaleString('en-IN')}
                        </Text>
                      </View>

                      {/* Middle Row: Note in quotes */}
                      {tx.note ? (
                        <Text className="text-slate-800 text-sm font-medium italic my-1">
                          &quot;{tx.note}&quot;
                        </Text>
                      ) : null}

                      {/* Bottom Row: Helper Action text + Delete Button */}
                      <View className={`flex-row items-center justify-between mt-2 pt-1.5 border-t ${isAltDay ? 'border-slate-300' : 'border-slate-100'}`}>
                        <View className="flex-1 mr-2">
                          <Text className={`font-black text-[10px] uppercase tracking-wider ${tx.completed ? 'text-slate-400' : 'text-[#00a2ed]'}`}>
                            {tx.completed ? '✓ COMPLETED • TAP TO RESTORE' : 'TAP TO COMPLETE • HOLD FOR OPTIONS'}
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                          {tx.audioUri && (
                            <View className="flex-row items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-[6px]">
                              <Mic color="#00a2ed" size={10} />
                              <Text className="text-[#00a2ed] font-black text-[9px] uppercase">Voice</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => deleteTransaction(tx.id)}
                            className="w-7 h-7 rounded-[6px] bg-rose-50 border border-rose-300 items-center justify-center active:bg-rose-100"
                            accessibilityLabel="Delete transaction"
                          >
                            <Trash2 color="#e11d48" size={13} strokeWidth={2.2} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View className="py-20 items-center justify-center">
                  <Text className="text-slate-400 font-bold text-sm">No transaction history recorded</Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}
