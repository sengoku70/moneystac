import AsyncStorage from '@react-native-async-storage/async-storage';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import * as LocalAuthentication from 'expo-local-authentication';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  History,
  LayoutGrid,
  List as ListIcon,
  Mic,
  Minus,
  MoreVertical,
  PieChart,
  Pin,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Share2,
  SlidersHorizontal,
  Square,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateDailyWidget, getTodayDateStr } from '../widgets/widget-sync';
import {
  addExchangerDB,
  addTransactionDB,
  clearAllTransactionsDB,
  deleteExchangerDB,
  deleteTransactionDB,
  fetchAllExchangers,
  initDB,
  INITIAL_EXCHANGERS,
  migrateFromAsyncStorage,
  resetBalanceDB,
  togglePinExchangerDB,
  updateTransactionCompletionDB,
  wipeEntireDB
} from '../services/database';

const HISTORY_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 10, minimumViewTime: 50 };

const requireAuth = async (action: () => void) => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && isEnrolled) {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to proceed',
        fallbackLabel: 'Use Passcode',
      });
      if (!auth.success) return;
    }
    action();
  } catch (err) {
    console.log(err);
    action();
  }
};

// Unique ID helper
const generateId = () => Math.random().toString(36).substring(2, 11);
const MYSELF_ID = 'default-myself-001';

interface ToBeLoggedItem {
  id: string;
  amount: number;
  direction: 'out' | 'in';
  note: string;
  date: string;
  audioUri?: string;
}

interface Transaction {
  id: string;
  delta: number;
  date: string;
  note?: string;
  audioUri?: string;
  completed?: boolean;
  exchangerId?: string;
  exchangerName?: string;
  splitGroupId?: string;
  splitTotal?: number;
  splitParticipants?: string[];
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


// Grid View Exchanger Card (Image 4)
const ExchangerGridCard = ({
  exchanger,
  openAdjust,
  deleteExchanger,
  promptResetBalance,
  togglePinExchanger
}: {
  exchanger: Exchanger;
  openAdjust: (ex: Exchanger, targetDate?: string) => void;
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
    <View className={`w-[48.5%] h-[215px] bg-white border-2 ${isPinned ? 'border-[#c084fc]' : isMeTo ? 'border-[#00a2ed]' : 'border-rose-400'} rounded-[14px] p-3.5 mb-3 shadow-xs justify-between`}>
      <View>
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-start gap-2">
            <TouchableOpacity
              onPress={() => openAdjust(exchanger)}
              className={`w-10 h-10 rounded-[10px] ${isPinned ? 'bg-purple-50 border-2 border-[#c084fc]' : isMeTo ? 'bg-sky-50 border-2 border-sky-400' : 'bg-rose-50 border-2 border-rose-400'} items-center justify-center`}
            >
              <Wallet color={isPinned ? '#c084fc' : isMeTo ? '#00a2ed' : '#e11d48'} size={19} strokeWidth={2} />
            </TouchableOpacity>

            {!isMyself && (
              <TouchableOpacity
                onPress={() => togglePinExchanger(exchanger.id)}
                className={`w-7 h-7 rounded-[7px] border-2 ${isPinned ? 'bg-purple-50 border-[#c084fc]' : 'bg-white border-slate-300'} items-center justify-center`}
                accessibilityLabel={isPinned ? 'Unpin stack' : 'Pin stack to top'}
              >
                <Pin
                  color={isPinned ? '#c084fc' : '#94a3b8'}
                  size={12}
                  strokeWidth={2}
                  fill={isPinned ? '#c084fc' : 'transparent'}
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
          <Text className={`${isPinned ? 'text-[#c084fc]' : isMeTo ? 'text-[#00a2ed]' : 'text-rose-700'} font-black text-xs uppercase tracking-wider mb-1`} numberOfLines={1}>
            {title}
          </Text>
          <Text className={`${isMeTo ? 'text-[#00a2ed]' : 'text-rose-600'} text-2xl font-black mb-1.5 tracking-tight`} numberOfLines={1}>
            ₹{Math.round(exchanger.balance || 0).toLocaleString('en-IN')}
          </Text>
        </TouchableOpacity>

        {/* Fixed height container for Note bubble */}
        <View className="h-[42px] justify-center mb-1">
          {exchanger.history?.[0]?.note ? (
            <View className="bg-slate-50/50 border-2 border-slate-400 rounded-[10px] p-1.5 justify-center">
              <Text className="text-slate-700 text-[11px] italic font-medium leading-4" numberOfLines={2}>
                &quot;{exchanger.history[0].note}&quot;
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
  openAdjust: (ex: Exchanger, targetDate?: string) => void;
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
    <View className={`h-[74px] bg-white border-2 ${isPinned ? 'border-[#c084fc]' : isMeTo ? 'border-[#00a2ed]' : 'border-rose-400'} rounded-[14px] px-3 py-2.5 mb-2.5 flex-row items-center justify-between shadow-xs`}>
      <View className="flex-row items-center flex-1 mr-2">
        <View className="flex-row items-start gap-2 mr-2.5">
          <TouchableOpacity
            onPress={() => openAdjust(exchanger)}
            className={`w-10 h-10 rounded-[10px] ${isPinned ? 'bg-purple-50 border-2 border-[#c084fc]' : isMeTo ? 'bg-sky-50 border-2 border-sky-400' : 'bg-rose-50 border-2 border-rose-400'} items-center justify-center`}
          >
            <Wallet color={isPinned ? '#c084fc' : isMeTo ? '#00a2ed' : '#e11d48'} size={19} strokeWidth={2} />
          </TouchableOpacity>

          {!isMyself && (
            <TouchableOpacity
              onPress={() => togglePinExchanger(exchanger.id)}
              className={`w-7 h-7 rounded-[7px] border-2 ${isPinned ? 'bg-purple-50 border-[#c084fc]' : 'bg-white border-slate-400'} items-center justify-center`}
              accessibilityLabel={isPinned ? 'Unpin stack' : 'Pin stack to top'}
            >
              <Pin
                color={isPinned ? '#c084fc' : '#64748b'}
                size={12}
                strokeWidth={2}
                fill={isPinned ? '#c084fc' : 'transparent'}
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => openAdjust(exchanger)}
          className="flex-1 justify-center"
        >
          <Text className={`${isPinned ? 'text-[#c084fc]' : isMeTo ? 'text-[#00a2ed]' : 'text-rose-700'} font-black text-xs uppercase tracking-wider`} numberOfLines={1}>
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
  return (
    <SQLiteProvider databaseName="moneystac_v2.db" onInit={initDB}>
      <MoneyStacInner />
    </SQLiteProvider>
  );
}

function MoneyStacInner() {
  const db = useSQLiteContext();

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
  const [isChartZoomedIn, setIsChartZoomedIn] = useState(true);

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('0');

  const [activeExchanger, setActiveExchanger] = useState<Exchanger | null>(null);

  // Synchronize activeExchanger with the latest exchangers list
  useEffect(() => {
    if (activeExchanger) {
      const fresh = exchangers.find(e => e.id === activeExchanger.id);
      if (fresh && fresh !== activeExchanger) {
        setActiveExchanger(fresh);
      }
    }
  }, [exchangers, activeExchanger]);

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustAudioUri, setAdjustAudioUri] = useState<string | null>(null);
  const [adjustTargetDate, setAdjustTargetDate] = useState<string | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const historyFlatListRef = useRef<FlatList>(null);
  const historyScrollRef = useRef<ScrollView>(null);
  const [activeHistoryDate, setActiveHistoryDate] = useState<string | null>(null);
  const isScrollingToDate = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Split Money Modal
  const [divideModalVisible, setDivideModalVisible] = useState(false);
  const [divideAmount, setDivideAmount] = useState('');
  const [divideNote, setDivideNote] = useState('');
  const [includeMyself, setIncludeMyself] = useState(true);
  const [selectedExchangers, setSelectedExchangers] = useState<string[]>([]);

  // Bulk Delete Transfers Modal
  const [deleteTransfersModalVisible, setDeleteTransfersModalVisible] = useState(false);

  // 100 Last Inputs Log Modal
  const [showLast100LogModal, setShowLast100LogModal] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'out' | 'in'>('all');

  // To-Be-Logged Inputs (Drafts / Pending Queue)
  const [toBeLoggedList, setToBeLoggedList] = useState<ToBeLoggedItem[]>([]);
  const [showToBeLoggedModal, setShowToBeLoggedModal] = useState(false);
  const [toBeLoggedAmount, setToBeLoggedAmount] = useState('');
  const [toBeLoggedNote, setToBeLoggedNote] = useState('');
  const [toBeLoggedDirection, setToBeLoggedDirection] = useState<'out' | 'in'>('out');
  const [toBeLoggedAudioUri, setToBeLoggedAudioUri] = useState<string | null>(null);
  const [assigningItem, setAssigningItem] = useState<ToBeLoggedItem | null>(null);
  const [assignTargetExchangerId, setAssignTargetExchangerId] = useState<string>('');
  const [assignDirection, setAssignDirection] = useState<'me_to_person' | 'person_to_me'>('me_to_person');
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);

  // Dynamic Audio Player for Voice Notes
  const [activePlayUri, setActivePlayUri] = useState<string | null>(null);
  const dynamicPlayer = useAudioPlayer(activePlayUri);

  useEffect(() => {
    if (activePlayUri && dynamicPlayer) {
      dynamicPlayer.seekTo(0);
      dynamicPlayer.play();
    }
  }, [activePlayUri, dynamicPlayer]);

  // Load To-Be-Logged items from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('moneystac_to_be_logged').then(data => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) setToBeLoggedList(parsed);
        } catch (e) {
          console.error('Failed to parse to_be_logged', e);
        }
      }
    });
  }, []);

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
      if (assigningItem) {
        setAssigningItem(null);
        return true;
      }
      if (showToBeLoggedModal) {
        setShowToBeLoggedModal(false);
        return true;
      }
      if (showLast100LogModal) {
        setShowLast100LogModal(false);
        return true;
      }
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
  }, [showFullHistory, showAnalytics, modalVisible, adjustModalVisible, divideModalVisible, showLast100LogModal, showToBeLoggedModal, assigningItem]);

  // Initial load from SQLite
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const savedBudget = await AsyncStorage.getItem('dailyBudget');
        const savedViewMode = await AsyncStorage.getItem('viewMode');

        if (savedBudget && isMounted) {
          setDailyBudget(savedBudget);
          setInputBudget(savedBudget);
        }
        if (savedViewMode && (savedViewMode === 'grid' || savedViewMode === 'list') && isMounted) {
          setViewMode(savedViewMode);
        }

        // Migrate and Fetch
        await migrateFromAsyncStorage(db);
        const data = await fetchAllExchangers(db);

        if (isMounted) {
          setExchangers(data.length > 0 ? data : INITIAL_EXCHANGERS);
        }
      } catch (e) {
        console.error('Failed to load DB data:', e);
        if (isMounted) {
          setExchangers(INITIAL_EXCHANGERS);
        }
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [db]);

  // Synchronize Home Screen Widget with Today's Expenditure & Daily Budget
  useEffect(() => {
    try {
      const myself = exchangers.find(e => e.id === 'default-myself-001' || e.name === 'ME');
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const currentDay = now.getDate();

      let spentToday = 0;
      let txCountToday = 0;

      if (myself && myself.history) {
        myself.history.forEach(tx => {
          try {
            const d = new Date(tx.date);
            if (
              d.getFullYear() === currentYear &&
              d.getMonth() === currentMonth &&
              d.getDate() === currentDay &&
              tx.delta < 0
            ) {
              spentToday += Math.abs(tx.delta);
              txCountToday++;
            }
          } catch { }
        });
      }

      const budgetNum = parseFloat(dailyBudget) || 350;
      const dateStr = getTodayDateStr(now);

      updateDailyWidget({
        todaySpent: Math.round(spentToday),
        dailyBudget: Math.round(budgetNum),
        txCount: txCountToday,
        pendingCount: toBeLoggedList.length,
        dateStr,
      });
    } catch (e) {
      console.log('Failed to sync daily widget:', e);
    }
  }, [exchangers, dailyBudget, toBeLoggedList]);

  // Deep Link listener for Quick Add from Android Widget
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      if (event.url && event.url.includes('quick-add')) {
        setShowToBeLoggedModal(true);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url && url.includes('quick-add')) {
        setShowToBeLoggedModal(true);
      }
    }).catch(() => {});

    const sub = Linking.addEventListener('url', handleUrl);
    return () => {
      sub.remove();
    };
  }, []);

  // Toggle and save viewMode
  const toggleViewMode = () => {
    const next = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(next);
    AsyncStorage.setItem('viewMode', next).catch(() => { });
  };

  // Save budget
  const saveDailyBudget = (amt: string) => {
    const clean = amt.replace(/[^0-9.]/g, '').trim();
    if (!clean) return;
    setDailyBudget(clean);
    setInputBudget(clean);
    AsyncStorage.setItem('dailyBudget', clean).catch(() => { });
    Alert.alert('Budget Saved', `Daily allowance updated to ₹${clean} / day`);
  };

  const addExchanger = () => {
    if (!newName.trim()) return Alert.alert('Error', 'Please enter a name');

    const nameExists = exchangers.some(e => e.name.toLowerCase().trim() === newName.toLowerCase().trim());
    if (nameExists) {
      return Alert.alert('Name Taken', 'This stack name already exists. Please choose a different name.');
    }

    const newEx = { id: generateId(), name: newName.trim().toUpperCase(), balance: parseFloat(newBalance) || 0, note: '', pinned: false, history: [] };
    const updated: Exchanger[] = [
      ...exchangers,
      newEx
    ];
    setExchangers(updated);
    addExchangerDB(db, newEx).catch(console.error);
    setNewName('');
    setNewBalance('0');
    setModalVisible(false);
  };

  const openAdjust = (exchanger: Exchanger, targetDate?: string) => {
    setActiveExchanger(exchanger);
    setAdjustAmount('');
    setAdjustNote('');
    setAdjustAudioUri(null);
    setAdjustTargetDate(targetDate);
    setAdjustModalVisible(true);
  };

  const commitAdjustment = (isAdd: boolean) => {
    if (!activeExchanger) return;
    const amount = parseFloat(adjustAmount) || 0;

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    const delta = isAdd ? amount : -amount;
    const hasDetails = adjustNote.trim().length > 0 || !!adjustAudioUri;

    if (!hasDetails) {
      Alert.alert('Note Required', 'Please add a note or voice note to describe this adjustment.');
      return;
    }

    const dateToUse = adjustTargetDate || new Date().toISOString();
    const newTx: Transaction = {
      id: generateId(),
      delta,
      date: dateToUse,
      note: adjustNote.trim() || undefined,
      audioUri: adjustAudioUri || undefined
    };

    let myselfTx: Transaction | null = null;
    if (activeExchanger.id !== MYSELF_ID && isAdd) {
      myselfTx = {
        id: generateId(),
        delta: -amount,
        date: new Date().toISOString(),
        note: `To ${activeExchanger.name}${adjustNote.trim() ? ': ' + adjustNote.trim() : ''}`,
        audioUri: adjustAudioUri || undefined
      };
    }

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
      } else if (e.id === MYSELF_ID && myselfTx) {
        const pastHistory = e.history || [];
        const newHistory = hasDetails ? [myselfTx, ...pastHistory] : pastHistory;

        return {
          ...e,
          balance: e.balance + myselfTx.delta,
          history: newHistory
        };
      }
      return e;
    });

    setExchangers(updated);

    const updatedActive = updated.find(e => e.id === activeExchanger.id);
    if (updatedActive) {
      setActiveExchanger(updatedActive);
    }

    // SQLite Sync
    if (hasDetails) {
      const ex = updated.find(e => e.id === activeExchanger.id);
      if (ex) addTransactionDB(db, newTx, activeExchanger.id, ex.balance).catch(console.error);

      if (myselfTx) {
        const myselfEx = updated.find(e => e.id === MYSELF_ID);
        if (myselfEx) addTransactionDB(db, myselfTx, MYSELF_ID, myselfEx.balance).catch(console.error);
      }
    }

    setAdjustAmount('');
    setAdjustNote('');
    setAdjustAudioUri(null);
    setIsRecording(false);
    Keyboard.dismiss();
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

    const updatedActive = updated.find(e => e.id === activeExchanger.id);
    if (updatedActive) {
      setActiveExchanger(updatedActive);
    }

    // SQLite Sync
    const ex = updated.find(e => e.id === activeExchanger.id);
    if (ex) addTransactionDB(db, newTx, activeExchanger.id, ex.balance).catch(console.error);

    setAdjustNote('');
    setAdjustAmount('');
    setAdjustAudioUri(null);
    setIsRecording(false);
    Keyboard.dismiss();
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
          onPress: () => requireAuth(() => {
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
            const updatedExchanger = updated.find(e => e.id === exchanger.id);
            if (updatedExchanger && activeExchanger?.id === exchanger.id) {
              setActiveExchanger(updatedExchanger);
            }
            resetBalanceDB(db, exchanger.id).catch(console.error);
          })
        }
      ]
    );
  };

  const toggleTransactionComplete = (txId: string) => {
    if (!activeExchanger) return;

    const targetTx = (activeExchanger.history || []).find(t => t.id === txId);
    if (!targetTx) return;

    const actionText = targetTx.completed ? 'Mark as Incomplete' : 'Mark as Complete';
    const warningText = targetTx.completed
      ? 'This will add the transaction amount back to the active balance. Are you sure?'
      : 'This will remove the transaction amount from the active balance (settled). Are you sure?';

    Alert.alert(
      `⚠️ Warning: ${actionText}`,
      warningText,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: targetTx.completed ? 'default' : 'destructive',
          onPress: () => requireAuth(() => {
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
              const tx = updatedExchanger.history?.find(t => t.id === txId);
              if (tx) {
                updateTransactionCompletionDB(db, txId, activeExchanger.id, !!tx.completed, updatedExchanger.balance).catch(console.error);
              }
            }
          })
        }
      ]
    );
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
          onPress: () => requireAuth(() => {
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
              deleteTransactionDB(db, txId, activeExchanger.id, updatedExchanger.balance).catch(console.error);
            }
          })
        }
      ]
    );
  };

  const availableMonthsForDeletion = useMemo(() => {
    const myself = exchangers.find(e => e.id === MYSELF_ID);
    if (!myself || !myself.history) return [];

    const monthMap = new Map<string, { label: string, endOfDate: number }>();
    myself.history.forEach(tx => {
      if (tx.delta < 0) {
        const d = new Date(tx.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!monthMap.has(key)) {
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
          const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          monthMap.set(key, { label, endOfDate: endOfMonth });
        }
      }
    });
    return Array.from(monthMap.values()).sort((a, b) => b.endOfDate - a.endOfDate);
  }, [exchangers]);

  const confirmDeleteTransfersUpToMonth = (monthItem: { label: string, endOfDate: number }) => {
    Alert.alert(
      'Delete Expenses',
      `Are you sure you want to delete all personal expenses and transfers made up to and including ${monthItem.label}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => requireAuth(async () => {
            const myself = exchangers.find(e => e.id === MYSELF_ID);
            if (!myself) return;

            const txsToDelete = (myself.history || []).filter(tx => {
              const d = new Date(tx.date);
              return d.getTime() <= monthItem.endOfDate &&
                tx.delta < 0;
            });

            if (txsToDelete.length === 0) {
              return Alert.alert('None Found', 'No expenses found.');
            }

            const idsToDelete = new Set(txsToDelete.map(t => t.id));
            let balanceAdjustment = 0;
            txsToDelete.forEach(tx => {
              if (!tx.completed) balanceAdjustment -= tx.delta; // delta is negative, so subtract negative = add positive
            });

            const updated = exchangers.map(e => {
              if (e.id === MYSELF_ID) {
                return {
                  ...e,
                  balance: e.balance + balanceAdjustment,
                  history: (e.history || []).filter(t => !idsToDelete.has(t.id))
                };
              }
              return e;
            });

            setExchangers(updated);
            setActiveExchanger(updated.find(e => e.id === MYSELF_ID) || null);
            setDeleteTransfersModalVisible(false);

            // DB Sync
            try {
              for (const tx of txsToDelete) {
                await db.runAsync('DELETE FROM transactions WHERE id = ? AND exchangerId = ?', [tx.id, MYSELF_ID]);
              }
              const newBal = updated.find(e => e.id === MYSELF_ID)?.balance || 0;
              await db.runAsync('UPDATE exchangers SET balance = ? WHERE id = ?', [newBal, MYSELF_ID]);
            } catch (err) { console.error('Failed to bulk delete', err); }
          })
        }
      ]
    );
  };

  const openDeleteTransfersModal = () => {
    if (availableMonthsForDeletion.length === 0) {
      Alert.alert('No Expenses', 'There are no expenses to delete.');
      return;
    }
    setDeleteTransfersModalVisible(true);
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
          onPress: () => requireAuth(() => {
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
            clearAllTransactionsDB(db, exchanger.id).catch(console.error);
          })
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
  }, [activeExchanger]);

  const formattedHistoryList = useMemo(() => {
    let day = '';
    let isGrey = false;
    const result: (Transaction & { _isLightGrey?: boolean })[] = [];
    for (const tx of fullHistoryList) {
      const txDay = new Date(tx.date).toDateString();
      if (txDay !== day) {
        day = txDay;
        isGrey = !isGrey;
      }
      result.push({ ...tx, _isLightGrey: isGrey });
    }
    return result;
  }, [fullHistoryList]);

  const uniqueHistoryDates = useMemo(() => {
    const dates: { label: string, index: number }[] = [];
    const seen = new Set<string>();
    formattedHistoryList.forEach((tx, idx) => {
      const label = getTxDateLabel(tx.date);
      if (!seen.has(label)) {
        seen.add(label);
        dates.push({ label, index: idx });
      }
    });
    return dates;
  }, [formattedHistoryList]);

  const handleHistoryViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (isScrollingToDate.current) return;
    if (viewableItems.length > 0) {
      const firstVisible = viewableItems[0].item;
      const label = getTxDateLabel(firstVisible.date);
      setActiveHistoryDate((prev) => {
        if (prev !== label) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          return label;
        }
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    if (activeHistoryDate && uniqueHistoryDates.length > 0) {
      const dateIdx = uniqueHistoryDates.findIndex(d => d.label === activeHistoryDate);
      if (dateIdx !== -1) {
        const reversedIdx = uniqueHistoryDates.length - 1 - dateIdx;
        historyScrollRef.current?.scrollTo({ x: Math.max(0, reversedIdx * 60 - 100), animated: true });
      }
    }
  }, [activeHistoryDate, uniqueHistoryDates]);

  // Format date helper for Activity Log & To-Be-Logged
  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = d.getDate();
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      const year = d.getFullYear();
      const hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      return `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  const playAudioUri = (uri: string) => {
    if (activePlayUri === uri && dynamicPlayer) {
      dynamicPlayer.seekTo(0);
      dynamicPlayer.play();
    } else {
      setActivePlayUri(uri);
    }
  };

  // Activity Log item type: either a single transaction or an aggregated split transaction
  type ActivityLogItem =
    | (Transaction & {
        isSplit: false;
        amount: number;
        exchangerName: string;
        exchangerId: string;
        isMyself: boolean;
      })
    | {
        id: string;
        isSplit: true;
        amount: number;
        delta: number;
        date: string;
        note?: string;
        splitGroupId: string;
        splitTotal: number;
        perPerson: number;
        participants: string[];
        isAdd?: boolean;
        completed?: boolean;
        displayTitle: string;
      };

  // Last 100 inputs across all exchangers - merges split transactions into 1 single log entry
  const last100Inputs = useMemo(() => {
    // Helper to clean and extract user-specified reason from notes
    const extractSplitReason = (rawNote?: string): string => {
      if (!rawNote) return '';
      const note = rawNote.trim();

      // Case 1: "₹600 split in Alice, Bob, Me (Dinner)"
      const parenMatch = note.match(/\(([^)]+)\)$/);
      if (parenMatch) {
        const inside = parenMatch[1].trim();
        if (!inside.includes('ways') && !inside.toLowerCase().includes('split') && !inside.toLowerCase().includes('share')) {
          return inside;
        }
      }

      // Case 2: "Split Money (...) - Dinner" or "My Share: Split Money (...) - Dinner"
      if (note.includes(' - ')) {
        const parts = note.split(' - ');
        const candidate = parts.slice(1).join(' - ').trim();
        if (candidate && !candidate.toLowerCase().includes('split') && !candidate.toLowerCase().includes('share')) {
          return candidate;
        }
      }

      // Case 3: "Split: Dinner"
      if (note.includes(':') && !note.startsWith('My Share:')) {
        const parts = note.split(':');
        const candidate = parts.slice(1).join(':').trim();
        if (candidate && !candidate.toLowerCase().includes('split')) {
          return candidate;
        }
      }

      // Filter out auto-generated boilerplate like "Split Money", "My Share:", etc.
      const stripped = note
        .replace(/^My Share:\s*/i, '')
        .replace(/^Split Money\s*(\([^)]*\))?\s*(-)?\s*/i, '')
        .replace(/^₹\d+(?:\.\d+)?\s*split in\s*[^()]+(\([^)]*\))?\s*/i, '')
        .replace(/^Split:\s*/i, '')
        .trim();

      if (
        !stripped ||
        (stripped.startsWith('(') && stripped.endsWith(')')) ||
        stripped.toLowerCase().includes('split') ||
        stripped.toLowerCase().includes('ways') ||
        stripped.toLowerCase().includes('my share')
      ) {
        return '';
      }

      return stripped;
    };

    // Helper to extract participant names from any note
    const extractNamesFromNote = (rawNote?: string): string[] => {
      if (!rawNote) return [];
      const note = rawNote.trim();

      // Check "split in Alice, Bob, Me"
      const inMatch = note.match(/split in\s+([^()\-]+)/i);
      if (inMatch) {
        return inMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      }

      // Check "(Alice, Bob, Me)"
      const parenMatch = note.match(/\(([^)]+)\)/);
      if (parenMatch) {
        const inside = parenMatch[1].trim();
        if (!inside.includes('ways') && !inside.toLowerCase().includes('share') && inside.includes(',')) {
          return inside.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      return [];
    };

    const splitGroups = new Map<string, {
      id: string;
      isSplit: true;
      amount: number;
      delta: number;
      date: string;
      note?: string;
      splitGroupId: string;
      splitTotal: number;
      perPerson: number;
      participants: string[];
      isAdd?: boolean;
      completed?: boolean;
      displayTitle: string;
    }>();

    const normalEntries: (Transaction & {
      isSplit: false;
      amount: number;
      exchangerName: string;
      exchangerId: string;
      isMyself: boolean;
    })[] = [];

    exchangers.forEach(ex => {
      const isMyself = ex.id === MYSELF_ID;
      (ex.history || []).forEach(tx => {
        const lowerNote = (tx.note || '').toLowerCase();
        const isExplicitSplit = !!tx.splitGroupId;
        const isLegacySplit = !isExplicitSplit && (
          lowerNote.includes('split') ||
          lowerNote.includes('my share') ||
          lowerNote.includes('divided')
        );

        if (isExplicitSplit || isLegacySplit) {
          const currentPerson = isMyself ? 'Me' : ex.name;
          const extractedNames = extractNamesFromNote(tx.note);
          const txTime = new Date(tx.date).getTime();
          const txAbsDelta = Math.abs(Math.round(tx.delta));

          // Find if this transaction belongs to an existing split group
          let targetGroupKey: string | null = null;
          if (tx.splitGroupId) {
            targetGroupKey = tx.splitGroupId;
          } else {
            // Check existing groups within 90 seconds window
            for (const [key, group] of splitGroups.entries()) {
              if (key.startsWith('legacy_')) {
                const groupTime = new Date(group.date).getTime();
                const timeDiff = Math.abs(txTime - groupTime);
                const shareMatch = Math.abs(Math.round(group.perPerson) - txAbsDelta) <= 1;
                if (timeDiff <= 90000 && shareMatch) {
                  targetGroupKey = key;
                  break;
                }
              }
            }
          }

          if (targetGroupKey && splitGroups.has(targetGroupKey)) {
            const existing = splitGroups.get(targetGroupKey)!;
            if (!existing.participants.includes(currentPerson)) {
              existing.participants.push(currentPerson);
            }
            extractedNames.forEach(n => {
              if (!existing.participants.includes(n)) existing.participants.push(n);
            });
            if (tx.splitParticipants) {
              tx.splitParticipants.forEach(n => {
                if (!existing.participants.includes(n)) existing.participants.push(n);
              });
            }

            if (tx.splitTotal && tx.splitTotal > existing.amount) {
              existing.amount = tx.splitTotal;
              existing.splitTotal = tx.splitTotal;
            } else if (!existing.splitTotal) {
              existing.amount += Math.abs(tx.delta);
            }

            if (!existing.note) {
              const r = extractSplitReason(tx.note);
              if (r) existing.note = r;
            }

            existing.displayTitle = `₹${existing.amount.toLocaleString('en-IN')} split in ${existing.participants.join(', ')}`;
          } else {
            let parsedTotal = tx.splitTotal || 0;
            const rupeeMatch = tx.note?.match(/₹(\d+(?:\.\d+)?)/);
            if (rupeeMatch && !parsedTotal) {
              parsedTotal = parseFloat(rupeeMatch[1]) || 0;
            }
            if (!parsedTotal) {
              parsedTotal = Math.abs(tx.delta);
            }

            const initialParticipants = Array.from(new Set([
              currentPerson,
              ...extractedNames,
              ...(tx.splitParticipants || [])
            ]));

            const userReason = extractSplitReason(tx.note);
            const groupKey = tx.splitGroupId || `legacy_${tx.id}_${Math.floor(txTime / 60000)}`;

            splitGroups.set(groupKey, {
              id: tx.splitGroupId || `split-${tx.id}`,
              isSplit: true,
              amount: parsedTotal,
              delta: tx.delta,
              date: tx.date,
              note: userReason || undefined,
              splitGroupId: groupKey,
              splitTotal: tx.splitTotal || (rupeeMatch ? parsedTotal : 0),
              perPerson: Math.abs(tx.delta),
              participants: initialParticipants,
              isAdd: tx.delta > 0,
              completed: tx.completed,
              displayTitle: `₹${parsedTotal.toLocaleString('en-IN')} split in ${initialParticipants.join(', ')}`
            });
          }
        } else {
          normalEntries.push({
            ...tx,
            isSplit: false,
            amount: Math.abs(tx.delta),
            exchangerId: ex.id,
            exchangerName: ex.name,
            isMyself
          });
        }
      });
    });

    // Final pass on splitGroups to ensure total amount matches participants * perPerson if total was unknown
    splitGroups.forEach(group => {
      if (group.participants.length > 1 && group.amount < group.perPerson * group.participants.length) {
        group.amount = Math.round(group.perPerson * group.participants.length);
        group.splitTotal = group.amount;
      }
      group.displayTitle = `₹${group.amount.toLocaleString('en-IN')} split in ${group.participants.join(', ')}`;
    });

    const allEntries: ActivityLogItem[] = [...Array.from(splitGroups.values()), ...normalEntries];
    allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allEntries.slice(0, 100);
  }, [exchangers]);

  const filteredLast100 = useMemo(() => {
    return last100Inputs.filter(item => {
      // Direction filter
      if (item.isSplit) {
        const isOutflow = !!item.isAdd;
        if (logFilter === 'out' && !isOutflow) return false;
        if (logFilter === 'in' && isOutflow) return false;
      } else {
        const isOutflow = item.isMyself ? item.delta < 0 : item.delta > 0;
        if (logFilter === 'out' && !isOutflow) return false;
        if (logFilter === 'in' && isOutflow) return false;
      }

      // Search filter
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const noteMatch = (item.note || '').toLowerCase().includes(q);
        const amountMatch = item.amount.toString().includes(q);
        if (item.isSplit) {
          const personMatch = item.participants.some(p => p.toLowerCase().includes(q));
          const titleMatch = item.displayTitle.toLowerCase().includes(q);
          if (!noteMatch && !personMatch && !amountMatch && !titleMatch) return false;
        } else {
          const nameMatch = item.exchangerName.toLowerCase().includes(q);
          if (!noteMatch && !nameMatch && !amountMatch) return false;
        }
      }
      return true;
    });
  }, [last100Inputs, logFilter, logSearchQuery]);

  const shareLoggedTransaction = async (item: ActivityLogItem) => {
    try {
      if (item.isSplit) {
        const message = `💸 MoneyStac Split Transaction:\n• Total Amount: ₹${item.amount.toLocaleString('en-IN')} (₹${item.perPerson.toLocaleString('en-IN')}/person)\n• Split: ₹${item.amount.toLocaleString('en-IN')} split in ${item.participants.join(', ')}\n• People Involved: ${item.participants.join(', ')}\n${item.note ? `• Note: ${item.note}\n` : ''}• Date: ${formatDateTime(item.date)}`;
        await Share.share({ message, title: 'Split Transaction' });
      } else {
        const dir = getTxDirectionLabel(item, { id: item.exchangerId || '', name: item.exchangerName, balance: 0 });
        const message = `💸 MoneyStac Transaction Record:\n• Stack: ${item.exchangerName}\n• Direction: ${dir}\n• Amount: ₹${Math.abs(item.delta).toLocaleString('en-IN')}\n${item.note ? `• Note: ${item.note}\n` : ''}• Date: ${formatDateTime(item.date)}\n• Status: ${item.completed ? 'Settled' : 'Active'}`;
        await Share.share({ message, title: `Transaction: ${item.exchangerName}` });
      }
    } catch (err) {
      console.error('Failed to share transaction', err);
    }
  };

  const jumpToExchangerStack = (exchangerId: string) => {
    const ex = exchangers.find(e => e.id === exchangerId);
    if (ex) {
      setShowLast100LogModal(false);
      openAdjust(ex);
    }
  };

  // To-Be-Logged persistence and operations
  const saveToBeLogged = async (items: ToBeLoggedItem[]) => {
    setToBeLoggedList(items);
    await AsyncStorage.setItem('moneystac_to_be_logged', JSON.stringify(items));
  };

  const addToBeLoggedItem = () => {
    const amount = parseFloat(toBeLoggedAmount) || 0;
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than ₹0.');
      return;
    }

    const newItem: ToBeLoggedItem = {
      id: generateId(),
      amount,
      direction: toBeLoggedDirection,
      note: toBeLoggedNote.trim(),
      date: new Date().toISOString(),
      audioUri: toBeLoggedAudioUri || undefined
    };

    const updated = [newItem, ...toBeLoggedList];
    saveToBeLogged(updated);
    setToBeLoggedAmount('');
    setToBeLoggedNote('');
    setToBeLoggedAudioUri(null);
    Keyboard.dismiss();
    Alert.alert('Saved to Queue', 'Transaction details kept! You can share it or put it on someone at any time.');
  };

  const shareToBeLoggedItem = async (item: ToBeLoggedItem) => {
    try {
      const typeLabel = item.direction === 'out' ? 'Paid / Outflow (Me ➔)' : 'Received / Inflow (➔ Me)';
      const message = `💸 MoneyStac Pending Transaction:\n• Amount: ₹${item.amount.toLocaleString('en-IN')}\n• Type: ${typeLabel}\n• Note: ${item.note || 'None'}\n• Date: ${formatDateTime(item.date)}`;
      
      const result = await Share.share({ message, title: 'Pending Transaction' });
      if (result.action === Share.sharedAction) {
        Alert.alert(
          'Transaction Shared',
          'Would you like to keep this in your To-Be-Logged queue or remove it now?',
          [
            { text: 'Keep in List', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => {
                const remaining = toBeLoggedList.filter(i => i.id !== item.id);
                saveToBeLogged(remaining);
              }
            }
          ]
        );
      }
    } catch (err) {
      console.error('Failed to share item', err);
    }
  };

  const commitAssignToBeLogged = (targetExchanger: Exchanger, isAdd: boolean) => {
    if (!assigningItem) return;
    const amount = assigningItem.amount;
    const delta = isAdd ? amount : -amount;
    const noteText = assigningItem.note || 'Logged transaction';
    const newTx: Transaction = {
      id: generateId(),
      delta,
      date: assigningItem.date || new Date().toISOString(),
      note: noteText,
      audioUri: assigningItem.audioUri || undefined
    };

    let myselfTx: Transaction | null = null;
    if (targetExchanger.id !== MYSELF_ID && isAdd) {
      myselfTx = {
        id: generateId(),
        delta: -amount,
        date: new Date().toISOString(),
        note: `To ${targetExchanger.name}${noteText ? ': ' + noteText : ''}`,
        audioUri: assigningItem.audioUri || undefined
      };
    }

    const updated = exchangers.map(e => {
      if (e.id === targetExchanger.id) {
        const pastHistory = e.history || [];
        return {
          ...e,
          balance: e.balance + delta,
          note: noteText,
          audioUri: assigningItem.audioUri ? assigningItem.audioUri : e.audioUri,
          history: [newTx, ...pastHistory]
        };
      } else if (e.id === MYSELF_ID && myselfTx) {
        const pastHistory = e.history || [];
        return {
          ...e,
          balance: e.balance + myselfTx.delta,
          history: [myselfTx, ...pastHistory]
        };
      }
      return e;
    });

    setExchangers(updated);
    const updatedActive = updated.find(e => e.id === activeExchanger?.id);
    if (updatedActive) {
      setActiveExchanger(updatedActive);
    }

    // SQLite Sync
    const ex = updated.find(e => e.id === targetExchanger.id);
    if (ex) addTransactionDB(db, newTx, targetExchanger.id, ex.balance).catch(console.error);
    if (myselfTx) {
      const myselfEx = updated.find(e => e.id === MYSELF_ID);
      if (myselfEx) addTransactionDB(db, myselfTx, MYSELF_ID, myselfEx.balance).catch(console.error);
    }

    // Remove from To-Be-Logged list
    const remaining = toBeLoggedList.filter(i => i.id !== assigningItem.id);
    saveToBeLogged(remaining);
    setAssigningItem(null);

    Alert.alert('Assigned', `Successfully put ₹${amount.toLocaleString('en-IN')} on ${targetExchanger.name}!`);
  };

  const openPutOnSomeone = (item: ToBeLoggedItem) => {
    setAssigningItem(item);
    setAssignDropdownOpen(false);
    const defaultEx = exchangers.find(e => e.id !== MYSELF_ID) || exchangers[0];
    setAssignTargetExchangerId(defaultEx?.id || '');
    setAssignDirection(item.direction === 'in' ? 'person_to_me' : 'me_to_person');
  };

  const handleSavePutOnSomeone = () => {
    if (!assigningItem) return;
    const target = exchangers.find(e => e.id === assignTargetExchangerId);
    if (!target) {
      Alert.alert('Selection Required', 'Please select a person from the dropdown.');
      return;
    }
    const isMyself = target.id === MYSELF_ID;
    const isAdd = isMyself
      ? (assignDirection === 'person_to_me')
      : (assignDirection === 'me_to_person');

    commitAssignToBeLogged(target, isAdd);
  };

  const commitDivide = (isAdd: boolean) => {
    const totalAmount = parseFloat(divideAmount) || 0;
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
    }
    const userReason = divideNote.trim();
    if (!userReason) {
      return Alert.alert('Note Required', 'Please enter a note to describe what this split is for (e.g. Dinner, Rent, Groceries).');
    }
    if (selectedExchangers.length === 0 && !includeMyself) {
      return Alert.alert('Selection Empty', 'Select at least one exchanger or yourself.');
    }

    const divisor = selectedExchangers.length + (includeMyself ? 1 : 0);
    const amountPerPerson = parseFloat((totalAmount / divisor).toFixed(2));
    const delta = isAdd ? amountPerPerson : -amountPerPerson;

    // Collect participant names so log shows total amount and who it was split with
    const otherParticipantNames = exchangers
      .filter(e => selectedExchangers.includes(e.id))
      .map(e => e.name);
    const allParticipantNames = [...otherParticipantNames];
    if (includeMyself) {
      allParticipantNames.push('Me');
    }
    const namesList = allParticipantNames.join(', ');
    const splitGroupId = generateId();
    const splitNote = `₹${totalAmount} split in ${namesList} (${userReason})`;

    const createdTxs: { tx: Transaction; exchangerId: string; newBalance: number }[] = [];

    const updated = exchangers.map(e => {
      const isStandardSelected = selectedExchangers.includes(e.id);
      const isMyselfAndIncluded = includeMyself && e.id === MYSELF_ID;

      if (isStandardSelected || isMyselfAndIncluded) {
        const pastHistory = e.history || [];
        const tx: Transaction = {
          id: generateId(),
          delta,
          date: new Date().toISOString(),
          note: splitNote,
          exchangerId: e.id,
          exchangerName: e.name,
          splitGroupId,
          splitTotal: totalAmount,
          splitParticipants: allParticipantNames
        };
        const newBal = e.balance + delta;
        createdTxs.push({ tx, exchangerId: e.id, newBalance: newBal });

        return {
          ...e,
          balance: newBal,
          note: splitNote,
          history: [tx, ...pastHistory]
        };
      }
      return e;
    });

    setExchangers(updated);

    const updatedActive = updated.find(e => e.id === activeExchanger?.id);
    if (updatedActive) {
      setActiveExchanger(updatedActive);
    }

    // SQLite sync
    createdTxs.forEach(item => {
      addTransactionDB(db, item.tx, item.exchangerId, item.newBalance).catch(console.error);
    });

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
          onPress: () => requireAuth(() => {
            const updated = exchangers.filter(e => e.id !== id);
            setExchangers(updated);
            deleteExchangerDB(db, id).catch(console.error);
            if (activeExchanger?.id === id) {
              setAdjustModalVisible(false);
              setShowFullHistory(false);
              setActiveExchanger(null);
            }
          })
        }
      ]
    );
  };

  const togglePinExchanger = (id: string) => {
    if (id === MYSELF_ID) return;
    const updated = exchangers.map(e => {
      if (e.id === id) {
        const newPinned = !e.pinned;
        togglePinExchangerDB(db, id, newPinned).catch(console.error);
        return { ...e, pinned: newPinned };
      }
      return e;
    });
    setExchangers(updated);
    if (activeExchanger?.id === id) {
      setActiveExchanger(prev => prev ? { ...prev, pinned: !prev.pinned } : null);
    }
  };



  // Analytics Helpers & Calculations
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  // Aggregate all transactions across exchangers for selected month
  const allMonthlyTransactions = useMemo(() => {
    const list: Transaction[] = [];
    const myself = exchangers.find(e => e.id === MYSELF_ID);
    if (myself) {
      (myself.history || []).forEach(tx => {
        try {
          const d = new Date(tx.date);
          if (d.getFullYear() === year && d.getMonth() === month) {
            list.push({
              ...tx,
              exchangerName: myself.name,
              exchangerId: myself.id
            });
          }
        } catch { }
      });
    }
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

  // Previous Month total calculation for dynamic comparison
  const prevMonthTotal = useMemo(() => {
    let sum = 0;
    const prevMonthDate = new Date(year, month - 1, 1);
    const prevY = prevMonthDate.getFullYear();
    const prevM = prevMonthDate.getMonth();

    const myself = exchangers.find(e => e.id === MYSELF_ID);
    if (myself) {
      (myself.history || []).forEach(tx => {
        try {
          const d = new Date(tx.date);
          if (d.getFullYear() === prevY && d.getMonth() === prevM && tx.delta < 0) {
            sum += Math.abs(tx.delta);
          }
        } catch { }
      });
    }
    return sum;
  }, [exchangers, year, month]);

  const diffPercent = useMemo(() => {
    if (prevMonthTotal <= 0) return 0;
    return Math.round(((monthOutflow - prevMonthTotal) / prevMonthTotal) * 100);
  }, [monthOutflow, prevMonthTotal]);
  const isOutflowLower = diffPercent <= 0;

  // Bar height helper: zoomed in caps at 500, zoomed out caps at 4000
  const getChartBarHeight = (amount: number) => {
    if (amount <= 0) return 0;
    const maxVal = isChartZoomedIn ? 500 : 4000;
    if (amount >= maxVal) return 100; // Fixed height touching the roof for anything at max or above
    return Math.max(5, (amount / maxVal) * 100);
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
    <View className="flex-1 bg-white relative">
      <SafeAreaView className="flex-1 bg-white">
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

              <View className="w-11 h-11" />
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
                  • {activeDayTxCount} {activeDayTxCount === 1 ? 'transaction' : 'transactions'}
                </Text>
                <Text className={`${isOverBudget ? 'text-rose-600' : 'text-emerald-600'} font-bold text-xs`}>
                  {isOverBudget
                    ? `• Over budget by ₹${(activeDaySpent - todayBudgetNum).toLocaleString('en-IN')}`
                    : `• Can spend ₹${remainingBudget.toLocaleString('en-IN')} more ${isFocusingToday ? 'today' : 'this day'}`}
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
                  <View className="flex-row items-center gap-2">
                    <Text className="text-slate-900 text-base font-black">
                      Sept vs Aug
                    </Text>
                    <View className={`${isOutflowLower ? 'bg-emerald-50 border-emerald-400' : 'bg-rose-50 border-rose-400'} border-2 px-1.5 py-0.5 rounded-[6px] flex-row items-center gap-0.5`}>
                      {isOutflowLower ? (
                        <TrendingDown color="#059669" size={10} strokeWidth={3} />
                      ) : (
                        <TrendingUp color="#e11d48" size={10} strokeWidth={3} />
                      )}
                      <Text className={`${isOutflowLower ? 'text-emerald-600' : 'text-rose-600'} font-black text-[9px] uppercase tracking-wider`}>
                        {isOutflowLower ? `${diffPercent}% VS AUG` : `+${diffPercent}% VS AUG`}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setIsChartZoomedIn(!isChartZoomedIn)}
                  className="w-11 h-11 bg-white border-2 border-slate-300 rounded-[10px] items-center justify-center shadow-xs active:bg-slate-50"
                  accessibilityLabel="Toggle Graph Zoom"
                >
                  {isChartZoomedIn ? (
                    <ZoomOut color="#00a2ed" size={18} strokeWidth={2.5} />
                  ) : (
                    <ZoomIn color="#00a2ed" size={18} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Horizontal divider inside Card 2 matching screenshot */}
              <View className="h-[1.5px] bg-slate-200 my-3" />

              {/* Legend Box */}
              <View className="border-2 border-slate-300 bg-white rounded-[10px] p-2.5 px-4 mb-3.5 flex-row justify-between items-center">
                <View className="flex-row items-center gap-2">
                  <View className="w-3.5 h-3.5 rounded-full bg-[#c084fc]/50 mr-0.5" />
                  <Text className="text-[#7e22ce] font-black text-xs">
                    {new Date(year, month - 1).toLocaleString('default', { month: 'short' })}: ₹{prevMonthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="w-3.5 h-3.5 rounded-full bg-[#00a2ed] mr-0.5" />
                  <Text className="text-[#00a2ed] font-black text-xs">
                    {new Date(year, month).toLocaleString('default', { month: 'short' })}: ₹{monthOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                    // Dynamically compute the previous month outflow for this day
                    let prevOutflow = 0;
                    const prevMonthDate = new Date(year, month - 1, 1);
                    const prevY = prevMonthDate.getFullYear();
                    const prevM = prevMonthDate.getMonth();
                    const myself = exchangers.find(e => e.id === MYSELF_ID);
                    if (myself) {
                      (myself.history || []).forEach(tx => {
                        try {
                          const d = new Date(tx.date);
                          if (d.getFullYear() === prevY && d.getMonth() === prevM && d.getDate() === day && tx.delta < 0) {
                            prevOutflow += Math.abs(tx.delta);
                          }
                        } catch { }
                      });
                    }

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
                  <View className={`${activeDaySpent > 0 ? 'bg-rose-50 border-rose-400' : 'bg-slate-50 border-slate-300'} border-2 px-2.5 h-8 rounded-[8px] justify-center`}>
                    <Text className={`${activeDaySpent > 0 ? 'text-rose-600' : 'text-slate-600'} font-black text-xs`}>
                      ₹{activeDaySpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>

                  {/* Quick Add Button */}
                  <TouchableOpacity
                    onPress={() => {
                      const myself = exchangers.find(e => e.id === MYSELF_ID || e.name === 'MYSELF') || exchangers[0];
                      if (myself) {
                        const d = new Date();
                        d.setFullYear(selectedMonth.getFullYear(), selectedMonth.getMonth(), activeFocusDay);
                        openAdjust(myself, d.toISOString());
                      }
                    }}
                    className="px-2.5 h-8 rounded-[8px] bg-[#00a2ed] border-2 border-[#00a2ed] flex-row items-center justify-center gap-1 shadow-xs active:opacity-80"
                    accessibilityLabel="Add Expense"
                  >
                    <Plus color="#ffffff" size={13} strokeWidth={3} />
                    <Text className="text-white font-black text-xs">ADD</Text>
                  </TouchableOpacity>

                  {selectedDay !== null && (
                    <TouchableOpacity
                      onPress={() => setSelectedDay(null)}
                      className="w-8 h-8 rounded-[8px] border-2 border-slate-400 bg-white items-center justify-center shadow-xs active:bg-slate-50"
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
                      if (myself) {
                        const d = new Date();
                        d.setFullYear(selectedMonth.getFullYear(), selectedMonth.getMonth(), activeFocusDay);
                        openAdjust(myself, d.toISOString());
                      }
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
                      MONTH OUTFLOW
                    </Text>
                    <Text className="text-slate-900 text-3xl font-black tracking-tight">
                      ₹{monthOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            {/* Search Bar with Integrated View Toggle + Action Buttons */}
            <View className="flex-row items-center gap-2.5 my-2.5">
              <View className="flex-1 h-12 bg-white border-2 border-slate-400 rounded-[14px] pl-3.5 pr-1.5 flex-row items-center shadow-xs">
                <Search color="#64748b" size={18} strokeWidth={2.5} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search exchanger..."
                  placeholderTextColor="#94a3b8"
                  className="text-slate-900 font-bold text-sm ml-2.5 flex-1 p-0 mr-1"
                />

                {/* Subtle vertical separator inside search bar */}
                <View className="h-6 w-[1.5px] bg-slate-200 mx-1" />

                {/* Integrated View Mode Toggle inside Search */}
                <TouchableOpacity
                  onPress={toggleViewMode}
                  className="w-9 h-9 rounded-[10px] bg-slate-100 items-center justify-center active:bg-slate-200"
                  accessibilityLabel="Toggle View Mode"
                >
                  {viewMode === 'grid' ? (
                    <ListIcon color="#1e293b" size={17} strokeWidth={2.4} />
                  ) : (
                    <LayoutGrid color="#1e293b" size={17} strokeWidth={2.4} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Log of 100 Last Inputs */}
              <TouchableOpacity
                onPress={() => setShowLast100LogModal(true)}
                className="w-12 h-12 bg-white border-2 border-slate-400 rounded-[14px] items-center justify-center shadow-xs active:bg-slate-100"
                accessibilityLabel="Log of 100 Last Inputs"
              >
                <History color="#1e293b" size={20} strokeWidth={2.4} />
              </TouchableOpacity>

              {/* List of To-Be-Logged Inputs */}
              <TouchableOpacity
                onPress={() => setShowToBeLoggedModal(true)}
                className="w-12 h-12 bg-white border-2 border-slate-400 rounded-[14px] items-center justify-center shadow-xs active:bg-slate-100 relative"
                accessibilityLabel="To-Be-Logged Inputs"
              >
                <Bookmark color={toBeLoggedList.length > 0 ? '#00a2ed' : '#1e293b'} size={19} strokeWidth={2.4} />
                {toBeLoggedList.length > 0 && (
                  <View className="absolute -top-1.5 -right-1.5 bg-[#00a2ed] rounded-full min-w-[18px] h-[18px] items-center justify-center px-1 border-2 border-white">
                    <Text className="text-white text-[9px] font-black">{toBeLoggedList.length}</Text>
                  </View>
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
      </SafeAreaView>

      {/* NEW STACK MODAL (White Theme) */}
      {modalVisible && (
        <View className="absolute inset-0 z-50 justify-end bg-slate-900/40">
          <View className="w-full flex-1 justify-end">
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
          </View>
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

                {activeExchanger && activeExchanger.id === MYSELF_ID && (
                  <TouchableOpacity
                    onPress={openDeleteTransfersModal}
                    className="w-9 h-9 rounded-[10px] bg-slate-50 border-2 border-slate-300 items-center justify-center shadow-xs active:bg-slate-100"
                    accessibilityLabel="More Options"
                  >
                    <MoreVertical color="#64748b" size={18} strokeWidth={2.2} />
                  </TouchableOpacity>
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
                    Paid Debt
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* History List */}
            {(activeExchanger?.history || []).length > 0 && (
              <View className="mt-3 mb-1">
                {/* Header Row: RECENT HISTORY on left, EXPAND on right matching screenshot */}
                <View className="flex-row justify-between items-center mb-2 px-0.5">
                  <View className="flex-row items-center gap-1.5">
                    <History color="#94a3b8" size={13} strokeWidth={2.4} />
                    <Text className="text-slate-400 text-[10px] uppercase tracking-[2px] font-black">
                      RECENT HISTORY
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowFullHistory(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Expand History"
                  >
                    <Text className="text-[#00a2ed] text-[10.5px] font-black uppercase tracking-wider">
                      View All
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="max-h-[210px]">
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {(() => {
                      let currentDay = '';
                      let isLightGrey = false;
                      return fullHistoryList.slice(0, 10).map(tx => {
                        const txDay = new Date(tx.date).toDateString();
                        if (txDay !== currentDay) {
                          currentDay = txDay;
                          isLightGrey = !isLightGrey;
                        }
                        const dirLabel = getTxDirectionLabel(tx, activeExchanger);
                        const isMyself = activeExchanger?.id === MYSELF_ID;
                        const isMeTo = dirLabel.startsWith('ME ➔');
                        const isSkyBlue = !isMyself && isMeTo;
                        const isMyselfOutflow = isMyself && isMeTo;

                        return (
                          <View
                            key={tx.id}
                            className={`border-2 ${tx.completed ? 'border-slate-200 opacity-60 bg-slate-50/50' : (isLightGrey ? 'border-slate-300 bg-slate-200' : 'border-slate-300 bg-white')} rounded-[14px] p-3.5 mb-2.5 shadow-xs`}
                          >
                            {/* Top Row: Date + Direction on left, Amount on right */}
                            <View className="flex-row justify-between items-center mb-0.5">
                              <Text className={`${isSkyBlue ? 'text-[#00a2ed]' : (isMyselfOutflow ? 'text-rose-600' : 'text-slate-600')} font-black text-xs uppercase tracking-wider`}>
                                {getTxDateLabel(tx.date)}  {dirLabel}
                              </Text>
                              <Text className={`font-black text-sm ${tx.completed
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
                      });
                    })()}
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

      {/* BULK DELETE TRANSFERS MODAL */}
      {deleteTransfersModalVisible && (
        <View className="absolute inset-0 z-50 justify-center items-center bg-slate-900/40 px-5">
          <View className="w-full bg-white border-2 border-slate-400 rounded-[16px] p-5 shadow-2xl max-h-[80%]">
            <View className="mb-4">
              <Text className="text-slate-500 text-[10px] uppercase tracking-[2px] font-black">Bulk Delete</Text>
              <Text className="text-rose-600 text-xl font-black tracking-tight" numberOfLines={1}>
                Remove Past Expenses
              </Text>
              <Text className="text-slate-600 text-sm mt-1 font-medium leading-5">
                Select a month below to delete all personal expenses and transfers made up to and including that month.
              </Text>
            </View>

            <ScrollView className="max-h-[300px] mb-4">
              {availableMonthsForDeletion.map((monthItem, i) => (
                <TouchableOpacity
                  key={monthItem.label}
                  onPress={() => confirmDeleteTransfersUpToMonth(monthItem)}
                  className={`py-3 px-4 rounded-xl border-2 border-slate-200 mb-2 active:bg-rose-50 active:border-rose-300 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}
                >
                  <Text className="text-slate-800 font-bold">{monthItem.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setDeleteTransfersModalVisible(false)}
              className="bg-slate-200 py-3 rounded-[12px] items-center mt-auto"
            >
              <Text className="text-slate-700 font-black tracking-widest text-sm uppercase">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SPLIT MONEY MODAL (White Theme - Positioned at Top of Screen) */}
      {divideModalVisible && (
        <View className="absolute inset-0 z-50 justify-start items-center bg-slate-900/40 px-4 pt-12">
          <View className="w-full bg-white border-2 border-slate-400 rounded-[18px] p-5 shadow-2xl max-h-[88%]">
            <View className="flex-row justify-between items-start mb-3">
              <View>
                <Text className="text-slate-500 text-[10px] uppercase tracking-[2px] font-black">Distribute Funds</Text>
                <Text className="text-slate-900 text-2xl font-black tracking-tight">Split Money</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setDivideModalVisible(false);
                  setDivideAmount('');
                  setDivideNote('');
                  setSelectedExchangers([]);
                }}
                className="w-9 h-9 rounded-[10px] bg-slate-100 border-2 border-slate-300 items-center justify-center active:bg-slate-200"
                accessibilityLabel="Close Split Modal"
              >
                <X color="#1e293b" size={18} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-3" keyboardShouldPersistTaps="handled">
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
                  placeholder="Note * (Required, e.g. Dinner, Rent...)"
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
                    <Text className="text-slate-900"> ₹{((parseFloat(divideAmount) || 0) / (selectedExchangers.length + (includeMyself ? 1 : 0) || 1)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} </Text>
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
                setDivideNote('');
                setSelectedExchangers([]);
              }}
              className="mt-1 items-center py-1.5"
            >
              <Text className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}



      {/* LAST 100 INPUTS LOG OVERLAY */}
      {showLast100LogModal && (
        <View className="absolute inset-0 z-[65] bg-white">
          <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row justify-between items-start px-5 pt-3 pb-3 border-b-2 border-slate-100">
              <View>
                <View className="flex-row items-center gap-1.5 mb-1">
                  <History color="#00a2ed" size={15} strokeWidth={2.5} />
                  <Text className="text-slate-400 text-[11px] font-black uppercase tracking-[2.5px]">
                    ACTIVITY LOG
                  </Text>
                </View>
                <Text className="text-slate-900 text-2xl font-black uppercase tracking-tight">
                  Last 100 Inputs
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowLast100LogModal(false)}
                className="w-10 h-10 rounded-[12px] bg-slate-100 border-2 border-slate-300 items-center justify-center active:bg-slate-200"
                accessibilityLabel="Close Activity Log"
              >
                <X color="#1e293b" size={20} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* Quick Stats Banner */}
            <View className="flex-row items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
              <View>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider">TOTAL LOGGED</Text>
                <Text className="text-slate-800 text-base font-black">{last100Inputs.length} / 100</Text>
              </View>
              <View className="items-end">
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider">TOTAL VOLUME</Text>
                <Text className="text-slate-800 text-base font-black">
                  ₹{last100Inputs.reduce((sum, item) => sum + (item.isSplit ? item.amount : Math.abs(item.delta)), 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Search + Filter Row */}
            <View className="px-5 py-2.5 bg-white border-b border-slate-100">
              <View className="h-10 bg-slate-50 border-2 border-slate-300 rounded-[12px] px-3 flex-row items-center mb-2">
                <Search color="#64748b" size={16} strokeWidth={2.5} />
                <TextInput
                  value={logSearchQuery}
                  onChangeText={setLogSearchQuery}
                  placeholder="Filter by note, person, or amount..."
                  placeholderTextColor="#94a3b8"
                  className="text-slate-900 font-bold text-xs ml-2 flex-1 p-0"
                />
                {logSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setLogSearchQuery('')}>
                    <X color="#94a3b8" size={16} />
                  </TouchableOpacity>
                )}
              </View>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setLogFilter('all')}
                  className={`px-3 py-1 rounded-[8px] border-2 ${logFilter === 'all' ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200'}`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${logFilter === 'all' ? 'text-white' : 'text-slate-600'}`}>
                    All ({last100Inputs.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setLogFilter('out')}
                  className={`px-3 py-1 rounded-[8px] border-2 ${logFilter === 'out' ? 'bg-[#00a2ed] border-[#00a2ed]' : 'bg-white border-slate-200'}`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${logFilter === 'out' ? 'text-white' : 'text-slate-600'}`}>
                    Outflow (Me ➔)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setLogFilter('in')}
                  className={`px-3 py-1 rounded-[8px] border-2 ${logFilter === 'in' ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-200'}`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-wider ${logFilter === 'in' ? 'text-white' : 'text-slate-600'}`}>
                    Inflow (➔ Me)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* List */}
            {filteredLast100.length > 0 ? (
              <FlatList
                data={filteredLast100}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                renderItem={({ item, index }) => {
                  if (item.isSplit) {
                    return (
                      <View
                        key={item.id}
                        className={`border-2 ${item.completed ? 'border-slate-200 opacity-70 bg-slate-50' : 'border-purple-300 bg-white'} rounded-[14px] p-3.5 mb-2.5 shadow-xs`}
                      >
                        {/* Top: Index + Date + Split Tag */}
                        <View className="flex-row justify-between items-center mb-1.5">
                          <View className="flex-row items-center gap-2">
                            <View className="px-1.5 py-0.5 rounded-[6px] bg-purple-50 border border-purple-300">
                              <Text className="text-purple-700 font-black text-[9px]">#{index + 1}</Text>
                            </View>
                            <Text className="text-slate-500 font-bold text-[11px]">
                              {formatDateTime(item.date)}
                            </Text>
                          </View>

                          <View className="px-2 py-0.5 rounded-[6px] bg-purple-50 border border-purple-300 flex-row items-center gap-1">
                            <Users color="#9333ea" size={11} strokeWidth={2.5} />
                            <Text className="text-purple-700 font-black text-[10px] uppercase tracking-wider">
                              SPLIT ({item.participants.length} PPL)
                            </Text>
                          </View>
                        </View>

                        {/* Headline: "₹600 split in Alice, Bob, Me" */}
                        <View className="my-1">
                          <Text className="text-purple-900 font-black text-lg tracking-tight">
                            ₹{item.amount.toLocaleString('en-IN')} split in {item.participants.join(', ')}
                          </Text>
                          <Text className="text-slate-500 font-bold text-xs mt-0.5">
                            ₹{item.amount.toLocaleString('en-IN')} total • ₹{item.perPerson.toLocaleString('en-IN')} / person
                          </Text>
                        </View>

                        {/* People Involved (Chips) */}
                        <View className="flex-row items-center flex-wrap gap-1.5 my-1.5">
                          <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider mr-0.5">
                            People Involved:
                          </Text>
                          {item.participants.map((person, pIdx) => (
                            <View key={pIdx} className="bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-[6px]">
                              <Text className="text-purple-800 font-bold text-[11px]">{person}</Text>
                            </View>
                          ))}
                        </View>

                        {/* Clean User Note (only if real user note provided) */}
                        {item.note ? (
                          <View className="my-1 bg-slate-50 p-2 rounded-[8px] border border-slate-200">
                            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-0.5">Note</Text>
                            <Text className="text-slate-800 text-xs font-semibold italic">
                              &quot;{item.note}&quot;
                            </Text>
                          </View>
                        ) : null}

                        {/* Bottom Share Row */}
                        <View className="flex-row items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                          <Text className="text-slate-400 text-[10px] font-black uppercase tracking-wider">
                            1 Split Record
                          </Text>
                          <TouchableOpacity
                            onPress={() => shareLoggedTransaction(item)}
                            className="flex-row items-center gap-1.5 bg-purple-50 border border-purple-300 px-3 py-1.5 rounded-[8px] active:bg-purple-100"
                          >
                            <Share2 color="#9333ea" size={13} strokeWidth={2.4} />
                            <Text className="text-purple-700 font-black text-[10.5px] uppercase tracking-wider">Share Split</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  const dirLabel = getTxDirectionLabel(item, { id: item.exchangerId || '', name: item.exchangerName, balance: 0 });
                  const isMyself = item.isMyself;
                  const isMeTo = dirLabel.startsWith('ME ➔');
                  const isSkyBlue = !isMyself && isMeTo;
                  const isMyselfOutflow = isMyself && isMeTo;

                  return (
                    <View
                      key={item.id}
                      className={`border-2 ${item.completed ? 'border-slate-200 opacity-70 bg-slate-50' : 'border-slate-300 bg-white'} rounded-[14px] p-3.5 mb-2.5 shadow-xs`}
                    >
                      {/* Top: Index + Date + Stack Name */}
                      <View className="flex-row justify-between items-center mb-1">
                        <View className="flex-row items-center gap-2">
                          <View className="px-1.5 py-0.5 rounded-[6px] bg-slate-100 border border-slate-300">
                            <Text className="text-slate-600 font-black text-[9px]">#{index + 1}</Text>
                          </View>
                          <Text className="text-slate-500 font-bold text-[11px]">
                            {formatDateTime(item.date)}
                          </Text>
                        </View>

                        <View className="px-2 py-0.5 rounded-[6px] bg-slate-100 border border-slate-300">
                          <Text className="text-slate-700 font-black text-[10px] uppercase tracking-wider">
                            {item.exchangerName}
                          </Text>
                        </View>
                      </View>

                      {/* Direction + Amount */}
                      <View className="flex-row justify-between items-center my-1">
                        <Text className={`font-black text-xs uppercase tracking-wider ${isSkyBlue ? 'text-[#00a2ed]' : (isMyselfOutflow ? 'text-rose-600' : 'text-slate-700')}`}>
                          {dirLabel}
                        </Text>
                        <Text className={`font-black text-base ${item.completed ? 'text-slate-400 line-through' : isSkyBlue ? 'text-[#00a2ed]' : (item.delta >= 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                          ₹{Math.round(Math.abs(item.delta)).toLocaleString('en-IN')}
                        </Text>
                      </View>

                      {/* Note */}
                      {item.note ? (
                        <Text className="text-slate-800 text-xs font-medium italic my-1 bg-slate-50 p-2 rounded-[8px] border border-slate-200">
                          &quot;{item.note}&quot;
                        </Text>
                      ) : null}

                      {/* Actions Bottom Bar */}
                      <View className="flex-row items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                        <View className="flex-row items-center gap-2">
                          {item.completed && (
                            <Text className="text-slate-400 font-black text-[9px] uppercase tracking-wider">✓ SETTLED</Text>
                          )}
                          {item.audioUri && (
                            <TouchableOpacity
                              onPress={() => playAudioUri(item.audioUri!)}
                              className="flex-row items-center gap-1 bg-[#00a2ed] px-2 py-1 rounded-[6px]"
                            >
                              <Play color="white" size={10} fill="white" />
                              <Text className="text-white font-black text-[9px] uppercase">Audio</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <View className="flex-row items-center gap-2">
                          <TouchableOpacity
                            onPress={() => shareLoggedTransaction(item)}
                            className="flex-row items-center gap-1 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-[8px] active:bg-slate-200"
                          >
                            <Share2 color="#475569" size={12} strokeWidth={2} />
                            <Text className="text-slate-700 font-bold text-[10px] uppercase">Share</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => jumpToExchangerStack(item.exchangerId)}
                            className="flex-row items-center gap-1 bg-sky-50 border border-sky-300 px-2.5 py-1 rounded-[8px] active:bg-sky-100"
                          >
                            <Text className="text-[#00a2ed] font-bold text-[10px] uppercase">View Stack</Text>
                            <ArrowRight color="#00a2ed" size={12} strokeWidth={2.2} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            ) : (
              <View className="py-24 items-center justify-center px-8">
                <History color="#cbd5e1" size={48} strokeWidth={1.5} />
                <Text className="text-slate-600 font-black text-base mt-4 text-center">No Inputs Found</Text>
                <Text className="text-slate-400 font-bold text-xs text-center mt-1">
                  Transactions added to any stack will automatically appear here.
                </Text>
              </View>
            )}
          </SafeAreaView>
        </View>
      )}

      {/* TO-BE-LOGGED INPUTS OVERLAY */}
      {showToBeLoggedModal && (
        <View className="absolute inset-0 z-[65] bg-white">
          <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row justify-between items-start px-5 pt-3 pb-3 border-b-2 border-slate-100">
              <View>
                <Text className="text-slate-400 text-[11px] font-black uppercase tracking-[2.5px] mb-1">
                  PENDING QUEUE
                </Text>
                <Text className="text-slate-900 text-2xl font-black uppercase tracking-tight">
                  To-Be-Logged Inputs
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowToBeLoggedModal(false);
                  setIsRecording(false);
                }}
                className="w-10 h-10 rounded-[12px] bg-slate-100 border-2 border-slate-300 items-center justify-center active:bg-slate-200"
                accessibilityLabel="Close To-Be-Logged"
              >
                <X color="#1e293b" size={20} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* Subtitle helper description */}
            <View className="px-5 py-2.5 bg-sky-50 border-b border-sky-100 flex-row items-center gap-2">
              <Bookmark color="#00a2ed" size={16} strokeWidth={2.2} />
              <Text className="text-sky-900 font-medium text-xs flex-1">
                Keep quick transaction details here until you share them or put them on someone.
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
              {/* Input Card to Add a New Item */}
              <View className="bg-slate-50 border-2 border-slate-300 rounded-[16px] p-4 mb-5 shadow-xs">
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mb-2">
                  RECORD NEW INPUT
                </Text>

                <View className="flex-row gap-2 mb-3">
                  <View className="flex-1 h-12 bg-white border-2 border-slate-300 rounded-[12px] px-3 flex-row items-center">
                    <Text className="text-slate-400 font-black text-lg mr-1.5">₹</Text>
                    <TextInput
                      value={toBeLoggedAmount}
                      onChangeText={setToBeLoggedAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor="#94a3b8"
                      className="text-slate-900 font-black text-lg flex-1 p-0"
                    />
                  </View>

                  <View className="flex-row bg-slate-200 p-1 rounded-[12px] border border-slate-300">
                    <TouchableOpacity
                      onPress={() => setToBeLoggedDirection('out')}
                      className={`px-3 justify-center rounded-[9px] ${toBeLoggedDirection === 'out' ? 'bg-white shadow-xs' : ''}`}
                    >
                      <Text className={`font-black text-xs ${toBeLoggedDirection === 'out' ? 'text-rose-600' : 'text-slate-500'}`}>
                        Me ➔ (Paid)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setToBeLoggedDirection('in')}
                      className={`px-3 justify-center rounded-[9px] ${toBeLoggedDirection === 'in' ? 'bg-white shadow-xs' : ''}`}
                    >
                      <Text className={`font-black text-xs ${toBeLoggedDirection === 'in' ? 'text-emerald-600' : 'text-slate-500'}`}>
                        ➔ Me (Recv)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Note + Voice note row */}
                <View className="flex-row gap-2 mb-3">
                  <TextInput
                    value={toBeLoggedNote}
                    onChangeText={setToBeLoggedNote}
                    placeholder="Note (e.g. Lunch, Taxi, Split share...)"
                    placeholderTextColor="#94a3b8"
                    className="flex-1 h-11 bg-white border-2 border-slate-300 rounded-[12px] px-3 font-bold text-xs text-slate-900"
                  />
                  <TouchableOpacity
                    onPress={async () => {
                      if (isRecording) {
                        setIsRecording(false);
                        await audioRecorder.stop();
                        setToBeLoggedAudioUri(audioRecorder.uri);
                      } else {
                        await startRecording();
                      }
                    }}
                    className={`w-11 h-11 rounded-[12px] items-center justify-center border-2 ${isRecording ? 'bg-rose-500 border-rose-400' : toBeLoggedAudioUri ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-300'}`}
                  >
                    {isRecording ? <Square color="white" size={17} /> : <Mic color={toBeLoggedAudioUri ? '#10b981' : '#64748b'} size={18} />}
                  </TouchableOpacity>
                </View>

                {/* Add to list button */}
                <TouchableOpacity
                  onPress={addToBeLoggedItem}
                  className="w-full bg-[#00a2ed] py-3 rounded-[12px] items-center justify-center flex-row gap-1.5 shadow-md shadow-sky-500/20 active:bg-sky-600"
                >
                  <Plus color="white" size={18} strokeWidth={2.5} />
                  <Text className="text-white font-black text-xs uppercase tracking-wider">
                    Add to Pending Queue
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Items Section Header */}
              <View className="flex-row justify-between items-center mb-2.5 px-0.5">
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px]">
                  PENDING ITEMS ({toBeLoggedList.length})
                </Text>
              </View>

              {/* Items List */}
              {toBeLoggedList.length > 0 ? (
                toBeLoggedList.map(item => (
                  <View
                    key={item.id}
                    className="bg-white border-2 border-slate-300 rounded-[16px] p-4 mb-3 shadow-xs"
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View>
                        <View className="flex-row items-center gap-2 mb-1">
                          <View className={`px-2 py-0.5 rounded-[6px] ${item.direction === 'out' ? 'bg-rose-50 border border-rose-300' : 'bg-emerald-50 border border-emerald-300'}`}>
                            <Text className={`font-black text-[10px] uppercase tracking-wider ${item.direction === 'out' ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {item.direction === 'out' ? 'Me ➔ (Paid)' : '➔ Me (Received)'}
                            </Text>
                          </View>
                          <Text className="text-slate-400 font-bold text-[10px]">
                            {formatDateTime(item.date)}
                          </Text>
                        </View>
                        <Text className="text-slate-900 text-2xl font-black">
                          ₹{item.amount.toLocaleString('en-IN')}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          const remaining = toBeLoggedList.filter(i => i.id !== item.id);
                          saveToBeLogged(remaining);
                        }}
                        className="w-8 h-8 rounded-[8px] bg-rose-50 border border-rose-300 items-center justify-center active:bg-rose-100"
                        accessibilityLabel="Delete item"
                      >
                        <Trash2 color="#e11d48" size={14} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>

                    {item.note ? (
                      <Text className="text-slate-800 text-xs font-medium italic my-1.5 bg-slate-50 p-2.5 rounded-[10px] border border-slate-200">
                        &quot;{item.note}&quot;
                      </Text>
                    ) : null}

                    {item.audioUri && (
                      <View className="my-1.5">
                        <TouchableOpacity
                          onPress={() => playAudioUri(item.audioUri!)}
                          className="flex-row items-center gap-1.5 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-[8px] self-start"
                        >
                          <Play color="#00a2ed" size={12} fill="#00a2ed" />
                          <Text className="text-[#00a2ed] font-black text-[10px] uppercase">Play Voice Note</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Action Buttons: Put on someone & Share */}
                    <View className="flex-row gap-2 mt-3 pt-2.5 border-t border-slate-100">
                      <TouchableOpacity
                        onPress={() => openPutOnSomeone(item)}
                        className="flex-1 bg-[#00a2ed] py-2.5 rounded-[10px] items-center justify-center flex-row gap-1.5 shadow-xs active:bg-sky-600"
                      >
                        <Users color="white" size={14} strokeWidth={2.4} />
                        <Text className="text-white font-black text-xs uppercase tracking-wider">
                          Put on Someone
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => shareToBeLoggedItem(item)}
                        className="flex-1 bg-slate-100 border border-slate-300 py-2.5 rounded-[10px] items-center justify-center flex-row gap-1.5 active:bg-slate-200"
                      >
                        <Share2 color="#475569" size={14} strokeWidth={2.4} />
                        <Text className="text-slate-700 font-black text-xs uppercase tracking-wider">
                          Share
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View className="py-20 items-center justify-center px-6">
                  <Bookmark color="#cbd5e1" size={44} strokeWidth={1.5} />
                  <Text className="text-slate-600 font-black text-base mt-4 text-center">No Pending Inputs</Text>
                  <Text className="text-slate-400 font-bold text-xs text-center mt-1 px-4">
                    Use the form above to jot down quick transaction details. They will stay here until you share them or put them on someone.
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}

      {/* PUT ON SOMEONE (ASSIGN TO EXCHANGER) OVERLAY */}
      {assigningItem && (() => {
        const selectedTarget = exchangers.find(e => e.id === assignTargetExchangerId) || exchangers[0];
        const isMyself = selectedTarget?.id === MYSELF_ID;

        return (
          <View className="absolute inset-0 z-[70] justify-center items-center bg-slate-900/40 px-5">
            <View className="w-full bg-white border-2 border-slate-400 rounded-[16px] p-5 shadow-2xl max-h-[88%]">
              {/* Header */}
              <View className="flex-row justify-between items-start mb-3">
                <View>
                  <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px]">PUT ON SOMEONE</Text>
                  <Text className="text-slate-900 text-2xl font-black tracking-tight">
                    ₹{assigningItem.amount.toLocaleString('en-IN')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setAssigningItem(null)}
                  className="w-8 h-8 rounded-[8px] bg-slate-100 border border-slate-300 items-center justify-center active:bg-slate-200"
                >
                  <X color="#64748b" size={18} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* Note Badge if exists */}
              {assigningItem.note ? (
                <View className="bg-slate-50 border border-slate-200 rounded-[10px] p-2.5 mb-3.5">
                  <Text className="text-slate-400 text-[9px] font-black uppercase tracking-wider mb-0.5">Note</Text>
                  <Text className="text-slate-800 text-xs font-semibold italic">
                    &quot;{assigningItem.note}&quot;
                  </Text>
                </View>
              ) : null}

              {/* 1. Name Dropdown */}
              <View className="mb-3.5">
                <Text className="text-slate-500 text-[10px] uppercase tracking-[2px] font-black mb-1.5 ml-0.5">
                  Select Person
                </Text>

                <TouchableOpacity
                  onPress={() => setAssignDropdownOpen(!assignDropdownOpen)}
                  className="h-12 bg-slate-50 border-2 border-slate-300 rounded-[12px] px-3.5 flex-row items-center justify-between active:bg-slate-100"
                >
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-7 h-7 rounded-[8px] bg-sky-100 border border-sky-300 items-center justify-center">
                      <User color="#00a2ed" size={15} strokeWidth={2.5} />
                    </View>
                    <Text className="text-slate-900 font-black text-sm">
                      {selectedTarget ? selectedTarget.name : 'Choose person...'}
                    </Text>
                    {isMyself && (
                      <View className="bg-slate-200 px-1.5 py-0.5 rounded-[4px]">
                        <Text className="text-slate-600 text-[8px] font-black">SELF</Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row items-center gap-2">
                    {selectedTarget && (
                      <View className="px-2 py-0.5 rounded-[6px] bg-slate-200">
                        <Text className="text-slate-700 font-bold text-[10px]">
                          Bal: ₹{Math.abs(selectedTarget.balance || 0).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    )}
                    <ChevronDown
                      color="#64748b"
                      size={18}
                      strokeWidth={2.4}
                      style={{ transform: [{ rotate: assignDropdownOpen ? '180deg' : '0deg' }] }}
                    />
                  </View>
                </TouchableOpacity>

                {/* Dropdown Options List */}
                {assignDropdownOpen && (
                  <View className="mt-1.5 bg-white border-2 border-slate-300 rounded-[12px] max-h-48 overflow-hidden shadow-lg z-20">
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                      {exchangers.map(ex => {
                        const isSelected = ex.id === selectedTarget?.id;
                        return (
                          <TouchableOpacity
                            key={ex.id}
                            onPress={() => {
                              setAssignTargetExchangerId(ex.id);
                              setAssignDropdownOpen(false);
                            }}
                            className={`flex-row justify-between items-center px-3.5 py-3 border-b border-slate-100 ${
                              isSelected ? 'bg-sky-50' : 'active:bg-slate-50'
                            }`}
                          >
                            <View className="flex-row items-center gap-2">
                              <Text className={`font-black text-xs uppercase ${isSelected ? 'text-[#00a2ed]' : 'text-slate-800'}`}>
                                {ex.name}
                              </Text>
                              {ex.id === MYSELF_ID && (
                                <View className="bg-slate-200 px-1.5 py-0.5 rounded-[4px]">
                                  <Text className="text-slate-600 text-[8px] font-black">SELF</Text>
                                </View>
                              )}
                            </View>

                            <View className="flex-row items-center gap-2">
                              <Text className={`font-bold text-[11px] ${(ex.balance || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                ₹{Math.abs(ex.balance || 0).toLocaleString('en-IN')}
                              </Text>
                              {isSelected && <Check color="#00a2ed" size={14} strokeWidth={3} />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* 2. Direction Selection: Me -> Person or Person -> Me */}
              <View className="mb-4">
                <Text className="text-slate-500 text-[10px] uppercase tracking-[2px] font-black mb-1.5 ml-0.5">
                  Select Direction
                </Text>

                <View className="flex-row gap-2.5">
                  {/* Me -> Person */}
                  <TouchableOpacity
                    onPress={() => setAssignDirection('me_to_person')}
                    className={`flex-1 py-3 px-2 rounded-[12px] border-2 items-center justify-center ${
                      assignDirection === 'me_to_person'
                        ? 'bg-sky-50 border-[#00a2ed] shadow-xs'
                        : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <View className="flex-row items-center gap-1 mb-0.5">
                      <ArrowRight
                        color={assignDirection === 'me_to_person' ? '#00a2ed' : '#64748b'}
                        size={14}
                        strokeWidth={2.5}
                      />
                      <Text
                        className={`font-black text-xs uppercase ${
                          assignDirection === 'me_to_person' ? 'text-[#00a2ed]' : 'text-slate-700'
                        }`}
                        numberOfLines={1}
                      >
                        {isMyself ? 'Me ➔ (Expense)' : `Me ➔ ${selectedTarget?.name || 'Person'}`}
                      </Text>
                    </View>
                    <Text className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                      {isMyself ? 'Personal Outflow' : 'I give / paid'}
                    </Text>
                  </TouchableOpacity>

                  {/* Person -> Me */}
                  <TouchableOpacity
                    onPress={() => setAssignDirection('person_to_me')}
                    className={`flex-1 py-3 px-2 rounded-[12px] border-2 items-center justify-center ${
                      assignDirection === 'person_to_me'
                        ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                        : 'bg-slate-50 border-slate-300'
                    }`}
                  >
                    <View className="flex-row items-center gap-1 mb-0.5">
                      <ArrowLeft
                        color={assignDirection === 'person_to_me' ? '#059669' : '#64748b'}
                        size={14}
                        strokeWidth={2.5}
                      />
                      <Text
                        className={`font-black text-xs uppercase ${
                          assignDirection === 'person_to_me' ? 'text-emerald-700' : 'text-slate-700'
                        }`}
                        numberOfLines={1}
                      >
                        {isMyself ? '➔ Me (Income)' : `${selectedTarget?.name || 'Person'} ➔ Me`}
                      </Text>
                    </View>
                    <Text className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                      {isMyself ? 'Personal Inflow' : 'They give me'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. Save Button */}
              <TouchableOpacity
                onPress={handleSavePutOnSomeone}
                className="w-full bg-[#00a2ed] py-3.5 rounded-[12px] items-center justify-center shadow-md shadow-sky-500/25 active:bg-sky-600 mb-2"
              >
                <Text className="text-white font-black text-sm uppercase tracking-wider">
                  Save
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAssigningItem(null)}
                className="items-center py-1.5"
              >
                <Text className="text-slate-500 font-bold text-xs uppercase tracking-wider">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {/* WHOLE PAGE TRANSACTION HISTORY OVERLAY (Matching screenshot) */}
      {showFullHistory && activeExchanger && (
        <View className="absolute inset-0 z-[60] bg-white">
          <SafeAreaView className="flex-1 bg-white">
            {/* Header matching screenshot */}
            <View className="flex-row justify-between items-start px-5 pt-3 pb-3 border-b-2 border-slate-100">
              <View>
                <View className="flex-row items-center gap-1.5 mb-1">
                  <History color="#00a2ed" size={15} strokeWidth={2.5} />
                  <Text className="text-slate-400 text-[11px] font-black uppercase tracking-[2.5px]">
                    TRANSACTION HISTORY
                  </Text>
                </View>
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

            {/* Horizontal Date Navigation Bar */}
            {uniqueHistoryDates.length > 0 && (
              <View className="border-b-2 border-slate-100 bg-slate-50/30">
                <ScrollView
                  horizontal
                  ref={historyScrollRef}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
                >
                  {[...uniqueHistoryDates].reverse().map((dateObj, reversedIdx) => {
                    const originalIdx = uniqueHistoryDates.length - 1 - reversedIdx;
                    const isActive = activeHistoryDate === dateObj.label || (activeHistoryDate === null && originalIdx === 0);
                    return (
                      <TouchableOpacity
                        key={dateObj.label}
                        onPress={() => {
                          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
                          isScrollingToDate.current = true;
                          setActiveHistoryDate(dateObj.label);
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          historyFlatListRef.current?.scrollToIndex({ index: dateObj.index, animated: false });
                          historyScrollRef.current?.scrollTo({ x: Math.max(0, reversedIdx * 60 - 100), animated: true });
                          scrollTimeoutRef.current = setTimeout(() => {
                            isScrollingToDate.current = false;
                          }, 150);
                        }}
                        className={`h-9 rounded-[10px] items-center justify-center flex-row px-3 border-2 ${isActive ? 'bg-[#00a2ed] border-[#00a2ed]' : 'bg-white border-slate-300 shadow-2xs'}`}
                      >
                        <Text className={`font-black text-[10px] uppercase ${isActive ? 'text-white' : 'text-slate-600'}`}>
                          {isActive ? dateObj.label : dateObj.label.split(' ')[0]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Scrollable list of cards matching user screenshot */}
            {formattedHistoryList.length > 0 ? (
              <FlatList
                ref={historyFlatListRef}
                data={formattedHistoryList}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
                onViewableItemsChanged={handleHistoryViewableItemsChanged}
                viewabilityConfig={HISTORY_VIEWABILITY_CONFIG}
                renderItem={({ item: tx }) => {
                  const dateLabel = getTxDateLabel(tx.date);
                  const dirLabel = getTxDirectionLabel(tx, activeExchanger);
                  const isMyself = activeExchanger?.id === MYSELF_ID;
                  const isMeTo = dirLabel.startsWith('ME ➔');
                  const isSkyBlue = !isMyself && isMeTo;
                  const isMyselfOutflow = isMyself && isMeTo;
                  const isLightGrey = tx._isLightGrey;

                  return (
                    <TouchableOpacity
                      onPress={() => toggleTransactionComplete(tx.id)}
                      onLongPress={() => handleHistoryLongPress(tx)}
                      delayLongPress={400}
                      activeOpacity={0.7}
                      className={`border-2 ${tx.completed ? 'border-slate-200 opacity-60 bg-slate-50/50' : (isLightGrey ? 'border-slate-300 bg-slate-200' : 'border-slate-300 bg-white')} rounded-[14px] p-4 mb-3.5 shadow-xs`}
                    >
                      {/* Top Row: Date + Direction and Amount */}
                      <View className="flex-row justify-between items-center mb-1">
                        <Text className={`${isSkyBlue ? 'text-[#00a2ed]' : (isMyselfOutflow ? 'text-rose-600' : 'text-slate-700')} font-black text-xs uppercase tracking-wider`}>
                          {dateLabel}  {dirLabel}
                        </Text>
                        <Text className={`font-black text-base ${tx.completed
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
                      <View className="flex-row items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
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
                }}
              />
            ) : (
              <View className="py-20 items-center justify-center">
                <Text className="text-slate-400 font-bold text-sm">No transaction history recorded</Text>
              </View>
            )}
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}
