import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Mic2,
  Music,
  Pause,
  Pin,
  PinOff,
  Play,
  Plus,
  Radio,
  Repeat2,
  Save,
  Search,
  Settings,
  Shuffle,
  SkipForward,
  SlidersHorizontal,
  StopCircle,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";

const STORAGE_KEY = "radio_cast_player_v2";
const PANEL_PREFS_KEY = "radio_cast_panel_prefs_v1";
const DB_NAME = "radio_cast_db";
const DB_VERSION = 1;
const TRACK_STORE = "tracks";
const LOGO_SRC = `${import.meta.env.BASE_URL}radiocast-logo.jpg`;

const buttonStyle =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition hover:-translate-y-0.5 active:translate-y-0";
const inputStyle =
  "min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100";
const panelStyle = "rounded-lg border border-slate-200 bg-white p-2 shadow-sm";

const DEFAULT_START = "09:00";
const DEFAULT_END = "12:00";
const PANEL_LAYOUT_KEY = "radio_cast_floating_panels_v1";
const DEFAULT_FLOATING_PANELS = {
  playlist: { x: 12, y: 12, w: 470, h: 382 },
  program: { x: 494, y: 12, w: 470, h: 382 },
  repeaters: { x: 976, y: 12, w: 318, h: 382 },
  radios: { x: 12, y: 406, w: 632, h: 246 },
  effects: { x: 656, y: 406, w: 638, h: 246 },
  lead: { x: 12, y: 664, w: 690, h: 190 },
  pisadores: { x: 714, y: 664, w: 580, h: 220 },
};
const WEATHER_CODE_LABELS = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Niebla",
  51: "Llovizna leve",
  53: "Llovizna",
  55: "Llovizna fuerte",
  61: "Lluvia leve",
  63: "Lluvia",
  65: "Lluvia fuerte",
  71: "Nieve leve",
  73: "Nieve",
  75: "Nieve fuerte",
  80: "Chaparrones leves",
  81: "Chaparrones",
  82: "Chaparrones fuertes",
  95: "Tormenta",
};
const PANEL_LABELS = {
  playlist: "Playlist MP3",
  program: "Programación",
  repeaters: "Repeticiones",
  radios: "Radios",
  effects: "Intro y efectos",
  lead: "Aire",
  pisadores: "Pisadores",
};

function openRadioDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB no disponible"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACK_STORE)) {
        db.createObjectStore(TRACK_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSavedTracks() {
  const db = await openRadioDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(TRACK_STORE, "readonly").objectStore(TRACK_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function putSavedTrack(track) {
  const db = await openRadioDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(TRACK_STORE, "readwrite").objectStore(TRACK_STORE).put(track);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteSavedTrack(id) {
  const db = await openRadioDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(TRACK_STORE, "readwrite").objectStore(TRACK_STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteTracksByCategory(category) {
  const items = await readSavedTracks();
  return Promise.all(
    items
      .filter((item) => (item.category || "track") === category)
      .map((item) => deleteSavedTrack(item.id))
  );
}

function getInitialState() {
  const fallback = {
    radios: [],
    pisadores: [],
    playlistMode: "sequential",
    nowPlayingLabel: "Nada reproduciéndose",
    stationName: "Radio Cast",
    stationSlogan: "Automatización de aire",
    stationDetails: "",
    stationCity: "",
    stationLogo: "",
    mainVolume: 0.9,
    programVolume: 0.9,
    radioVolume: 0.9,
    effectVolume: 1,
    introVolume: 1,
    repeaterVolume: 1.15,
    duckingVolume: 0.22,
    mixFoldersOnLoad: true,
    trimSilence: true,
    featuredTrackIds: [],
    outputDeviceId: "",
    inputDeviceId: "",
    desktopCloseToTray: false,
    desktopAutoLaunch: false,
    desktopMediaShortcuts: true,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatProgramMinutes(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  if (hh > 0) return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function formatPercent(value, max = 1) {
  const safe = Math.max(0, Math.min(max, Number(value) || 0));
  return `${Math.round((safe / max) * 100)}%`;
}

function getStatusTone(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("no se pudo") || text.includes("error")) return "border-red-400/30 bg-red-500/10 text-red-100";
  if (text.includes("reproduciendo") || text.includes("activa") || text.includes("habilitado") || text.includes("instalada")) return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
  if (text.includes("paus") || text.includes("suspend")) return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  return "border-white/10 bg-white/5 text-white";
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isNowInRange(start, end) {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const startMin = timeToMinutes(start || DEFAULT_START);
  const endMin = timeToMinutes(end || DEFAULT_END);

  if (startMin === endMin) return false;
  if (startMin < endMin) return current >= startMin && current < endMin;
  return current >= startMin || current < endMin;
}

function interleaveArrays(existing, incoming) {
  if (!existing.length) return incoming;
  const result = [];
  const max = Math.max(existing.length, incoming.length);
  for (let index = 0; index < max; index += 1) {
    if (index < existing.length) result.push(existing[index]);
    if (index < incoming.length) result.push(incoming[index]);
  }
  return result;
}

function buildProgramBlocks(items) {
  const blocks = [];
  let currentBlock = {
    id: `block-${crypto.randomUUID()}`,
    label: "Bloque 1",
    afterAction: "continue",
    separatorId: null,
    tracks: [],
  };

  items.forEach((item) => {
    if (item.kind === "separator") {
      if (!currentBlock.tracks.length) return;
      currentBlock = {
        ...currentBlock,
        label: item.blockName || currentBlock.label,
        afterAction: item.afterAction || "continue",
        separatorId: item.id,
      };
      blocks.push(currentBlock);
      currentBlock = {
        id: `block-${crypto.randomUUID()}`,
        label: `Bloque ${blocks.length + 1}`,
        afterAction: "continue",
        separatorId: null,
        tracks: [],
      };
      return;
    }

    currentBlock.tracks.push(item);
  });

  if (currentBlock.tracks.length) blocks.push(currentBlock);
  return blocks;
}

export default function App() {
  const desktopApi = typeof window !== "undefined" ? window.radioCastDesktop : null;
  const isDesktopApp = Boolean(desktopApi?.isDesktop);
  const [state, setState] = useState(getInitialState);
  const [tracks, setTracks] = useState([]);
  const [backgroundTracks, setBackgroundTracks] = useState([]);
  const [programTracks, setProgramTracks] = useState([]);
  const [repeaters, setRepeaters] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [selectedProgramTrackId, setSelectedProgramTrackId] = useState("");
  const [isMainPlaying, setIsMainPlaying] = useState(false);
  const [isOverlayPlaying, setIsOverlayPlaying] = useState(false);
  const [playingType, setPlayingType] = useState("detenido");
  const [status, setStatus] = useState("Listo para operar");
  const [radioName, setRadioName] = useState("");
  const [radioUrl, setRadioUrl] = useState("");
  const [radioStart, setRadioStart] = useState(DEFAULT_START);
  const [radioEnd, setRadioEnd] = useState(DEFAULT_END);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [clockNow, setClockNow] = useState(() => new Date());
  const [weatherInfo, setWeatherInfo] = useState({ loading: false, text: "Sin ciudad", temperature: "", code: null });
  const [vuMeters, setVuMeters] = useState({
    main: {
      levels: [0, 0],
      peaks: [0, 0],
    },
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState("station");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [audioInputs, setAudioInputs] = useState([]);
  const [isDucked, setIsDucked] = useState(false);
  const [trackMenu, setTrackMenu] = useState(null);
  const [introTrack, setIntroTrack] = useState(null);
  const [effects, setEffects] = useState(Array.from({ length: 8 }, () => null));
  const [pisadores, setPisadores] = useState([]);
  const [speechTimerMinutes, setSpeechTimerMinutes] = useState(20);
  const [speechTimerRemaining, setSpeechTimerRemaining] = useState(20 * 60);
  const [speechTimerRunning, setSpeechTimerRunning] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [playlistTab, setPlaylistTab] = useState("all");
  const [programDropActive, setProgramDropActive] = useState(false);
  const [programBlockDrafts, setProgramBlockDrafts] = useState({});
  const [cityMatches, setCityMatches] = useState([]);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [draftWeatherInfo, setDraftWeatherInfo] = useState({ text: "", temperature: "", loading: false });
  const [panelPrefs, setPanelPrefs] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PANEL_PREFS_KEY) || "{}");
      return Object.fromEntries(Object.keys(PANEL_LABELS).map((id) => [id, { visible: raw[id]?.visible !== false, pinned: raw[id]?.pinned === true }]));
    } catch {
      return Object.fromEntries(Object.keys(PANEL_LABELS).map((id) => [id, { visible: true, pinned: false }]));
    }
  });
  const [stationDraft, setStationDraft] = useState(() => ({
    stationName: getInitialState().stationName,
    stationSlogan: getInitialState().stationSlogan,
    stationDetails: getInitialState().stationDetails,
    stationCity: getInitialState().stationCity || "",
    stationLogo: getInitialState().stationLogo,
  }));
  const [floatingPanels, setFloatingPanels] = useState(() => {
    try {
      const raw = localStorage.getItem(PANEL_LAYOUT_KEY);
      return raw ? { ...DEFAULT_FLOATING_PANELS, ...JSON.parse(raw) } : DEFAULT_FLOATING_PANELS;
    } catch {
      return DEFAULT_FLOATING_PANELS;
    }
  });
  const [panelOrder, setPanelOrder] = useState(["playlist", "program", "repeaters", "radios", "effects", "lead", "pisadores"]);

  const mainAudioRef = useRef(null);
  const overlayAudioRef = useRef(null);
  const micAudioRef = useRef(null);
  const micStreamRef = useRef(null);
  const meterTimerRef = useRef(null);
  const duckingTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const overlayGraphRef = useRef(null);
  const trackInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const programTrackInputRef = useRef(null);
  const programFolderInputRef = useRef(null);
  const repeaterInputRef = useRef(null);
  const introInputRef = useRef(null);
  const pisadorInputRef = useRef(null);
  const stationLogoInputRef = useRef(null);
  const tracksRef = useRef([]);
  const backgroundTracksRef = useRef([]);
  const programTracksRef = useRef([]);
  const repeatersRef = useRef([]);
  const selectedTrackIdRef = useRef("");
  const selectedProgramTrackIdRef = useRef("");
  const stateRef = useRef(state);
  const schedulerRadioIdRef = useRef("");
  const mainLabelRef = useRef("Nada reproduciéndose");
  const isDuckedRef = useRef(false);
  const mainTypeRef = useRef("detenido");
  const overlayKindRef = useRef("");
  const overlayLabelRef = useRef("");
  const mainMeterRef = useRef(null);
  const overlayMeterRef = useRef(null);
  const pisadoresRef = useRef([]);
  const playlistTrackCounterRef = useRef(0);
  const pendingAfterOverlayRef = useRef(null);
  const vuPeakStateRef = useRef({
    main: [0, 0],
  });
  const workspaceRef = useRef(null);
  const panelActionRef = useRef(null);

  const selectedTrack = useMemo(
    () => [...tracks, ...backgroundTracks].find((track) => track.id === selectedTrackId) || tracks[0] || backgroundTracks[0],
    [tracks, backgroundTracks, selectedTrackId]
  );
  const selectedProgramTrack = useMemo(
    () => programTracks.find((track) => track.id === selectedProgramTrackId && track.kind !== "separator") || programTracks.find((track) => track.kind !== "separator"),
    [programTracks, selectedProgramTrackId]
  );
  const programBlocks = useMemo(() => buildProgramBlocks(programTracks), [programTracks]);
  const hasProgramSeparators = useMemo(() => programTracks.some((track) => track.kind === "separator"), [programTracks]);
  const workspaceCanvas = useMemo(() => {
    const visibleIds = Object.entries(panelPrefs)
      .filter(([, prefs]) => prefs.visible)
      .map(([id]) => id);
    const width = Math.max(
      1240,
      ...visibleIds.map((id) => {
        const panel = floatingPanels[id] || DEFAULT_FLOATING_PANELS[id];
        return (panel?.x || 0) + (panel?.w || 0) + 24;
      })
    );
    const height = Math.max(
      900,
      ...visibleIds.map((id) => {
        const panel = floatingPanels[id] || DEFAULT_FLOATING_PANELS[id];
        return (panel?.y || 0) + (panel?.h || 0) + 24;
      })
    );
    return { width, height };
  }, [floatingPanels, panelPrefs]);
  const filteredTracks = useMemo(() => {
    const query = playlistSearch.trim().toLowerCase();
    let next = tracks;
    if (playlistTab === "background") {
      next = backgroundTracks;
    }
    if (playlistTab === "featured") {
      next = tracks.filter((track) => state.featuredTrackIds.includes(track.id));
    }
    if (!query) return next;
    return next.filter(
      (track) =>
        track.name.toLowerCase().includes(query) ||
        track.fileName.toLowerCase().includes(query)
    );
  }, [backgroundTracks, playlistSearch, playlistTab, state.featuredTrackIds, tracks]);
  const stationLogoSrc = state.stationLogo || LOGO_SRC;
  const seekEnabled = Number.isFinite(duration) && duration > 0;
  const totalProgramSeconds = useMemo(
    () => programBlocks.reduce((total, block) => total + block.tracks.reduce((sum, item) => sum + Number(item.duration || 0), 0), 0),
    [programBlocks]
  );
  const currentProgramBlock = useMemo(() => {
    if (!String(playingType).includes("program")) return null;
    const activeId = selectedProgramTrackId;
    const block = programBlocks.find((item) => item.tracks.some((track) => track.id === activeId));
    if (!block) return null;

    const activeTrackIndex = block.tracks.findIndex((item) => item.id === activeId);
    const elapsedInBlock = block.tracks.reduce((total, item, index) => {
      if (index < activeTrackIndex) return total + Number(item.duration || 0);
      if (index === activeTrackIndex) return total + Number(currentTime || 0);
      return total;
    }, 0);
    const totalSeconds = block.tracks.reduce((total, item) => total + Number(item.duration || 0), 0);

    return {
      label: block.label,
      totalSeconds,
      remainingSeconds: Math.max(0, totalSeconds - elapsedInBlock),
      action: block.afterAction || "continue",
    };
  }, [currentTime, playingType, programBlocks, selectedProgramTrackId]);
  const speechTimerProgress = useMemo(() => {
    const total = Math.max(1, speechTimerMinutes * 60);
    return Math.max(0, Math.min(100, (speechTimerRemaining / total) * 100));
  }, [speechTimerMinutes, speechTimerRemaining]);
  const speechTimerTone =
    speechTimerRemaining <= 60 ? "text-red-600" : speechTimerRemaining <= 180 ? "text-amber-500" : "text-emerald-600";

  useEffect(() => {
    setProgramBlockDrafts((prev) => {
      const next = {};
      programBlocks.forEach((block) => {
        const key = block.separatorId || block.id;
        next[key] = prev[key] ?? block.label;
      });
      return next;
    });
  }, [programBlocks]);

  useEffect(() => {
    const serializable = {
      radios: state.radios,
      pisadores: state.pisadores.filter((item) => item.source === "url"),
      playlistMode: state.playlistMode,
      nowPlayingLabel: state.nowPlayingLabel,
      stationName: state.stationName,
      stationSlogan: state.stationSlogan,
      stationDetails: state.stationDetails,
      stationCity: state.stationCity,
      stationLogo: state.stationLogo,
      mainVolume: state.mainVolume,
      programVolume: state.programVolume,
      radioVolume: state.radioVolume,
      effectVolume: state.effectVolume,
      introVolume: state.introVolume,
      repeaterVolume: state.repeaterVolume,
      duckingVolume: state.duckingVolume,
      mixFoldersOnLoad: state.mixFoldersOnLoad,
      trimSilence: state.trimSilence,
      featuredTrackIds: state.featuredTrackIds,
      outputDeviceId: state.outputDeviceId,
      inputDeviceId: state.inputDeviceId,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      setStatus("No se pudo guardar todo en el navegador. Probá con un logo más liviano.");
    }
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(panelPrefs));
    } catch {}
  }, [panelPrefs]);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    setSettingsSection("station");
    setStationDraft({
      stationName: state.stationName || "",
      stationSlogan: state.stationSlogan || "",
      stationDetails: state.stationDetails || "",
      stationCity: state.stationCity || "",
      stationLogo: state.stationLogo || "",
    });
    setCityMatches([]);
    setDraftWeatherInfo({ text: "", temperature: "", loading: false });
  }, [settingsOpen, state.stationCity, state.stationDetails, state.stationLogo, state.stationName, state.stationSlogan]);

  useEffect(() => {
    const city = String(state.stationCity || "").trim();
    if (!city) {
      setWeatherInfo({ loading: false, text: "Sin ciudad", temperature: "", code: null });
      return;
    }

    let cancelled = false;
    async function loadWeather() {
      setWeatherInfo((prev) => ({ ...prev, loading: true }));
      try {
        const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`);
        const geoData = await geoResponse.json();
        const place = geoData?.results?.[0];
        if (!place) throw new Error("Ciudad no encontrada");

        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current_weather=true&timezone=auto`);
        const weatherData = await weatherResponse.json();
        const current = weatherData?.current_weather;
        if (!current) throw new Error("Sin datos");
        if (cancelled) return;

        setWeatherInfo({
          loading: false,
          text: WEATHER_CODE_LABELS[current.weathercode] || "Tiempo actual",
          temperature: `${Math.round(current.temperature)}°C`,
          code: current.weathercode,
        });
      } catch {
        if (!cancelled) setWeatherInfo({ loading: false, text: "Clima no disponible", temperature: "", code: null });
      }
    }

    loadWeather();
    const timer = setInterval(loadWeather, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state.stationCity]);

  useEffect(() => {
    const clampPanels = () => {
      if (!workspaceRef.current) return;
      const width = workspaceRef.current.clientWidth;
      const height = workspaceRef.current.clientHeight;
      if (!width || !height) return;
      setFloatingPanels((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([id, panel]) => {
          if (!panel) return;
          const clamped = {
            ...panel,
            w: Math.min(width - 12, Math.max(260, panel.w)),
            h: Math.min(height - 12, Math.max(170, panel.h)),
          };
          clamped.x = Math.min(Math.max(0, clamped.x), Math.max(0, width - clamped.w));
          clamped.y = Math.min(Math.max(0, clamped.y), Math.max(0, height - clamped.h));
          if (clamped.x !== panel.x || clamped.y !== panel.y || clamped.w !== panel.w || clamped.h !== panel.h) {
            next[id] = clamped;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    clampPanels();
    if (typeof ResizeObserver !== "undefined" && workspaceRef.current) {
      const observer = new ResizeObserver(clampPanels);
      observer.observe(workspaceRef.current);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", clampPanels);
    return () => window.removeEventListener("resize", clampPanels);
  }, []);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    backgroundTracksRef.current = backgroundTracks;
  }, [backgroundTracks]);

  useEffect(() => {
    programTracksRef.current = programTracks;
  }, [programTracks]);

  useEffect(() => {
    repeatersRef.current = repeaters;
  }, [repeaters]);

  useEffect(() => {
    pisadoresRef.current = pisadores;
  }, [pisadores]);

  useEffect(() => {
    selectedTrackIdRef.current = selectedTrackId;
  }, [selectedTrackId]);

  useEffect(() => {
    selectedProgramTrackIdRef.current = selectedProgramTrackId;
  }, [selectedProgramTrackId]);

  useEffect(() => {
    let cancelled = false;

    readSavedTracks()
      .then((savedTracks) => {
        if (cancelled || !savedTracks.length) return;

        const general = [];
        const backgrounds = [];
        const programming = [];
        const restoredRepeaters = [];
        const restoredPisadores = [];
        const nextEffects = Array.from({ length: 8 }, () => null);
        let nextIntro = null;

        savedTracks.forEach((track) => {
          if (track.category === "program-separator") {
            programming.push({
              id: track.id,
              kind: "separator",
              name: track.name || "Separador",
              blockName: track.blockName || track.name || "Bloque",
              afterAction: track.afterAction || "continue",
            });
            return;
          }
          if (!track.file) return;
          const restored = {
            id: track.id,
            name: track.name,
            fileName: track.fileName,
            folderName: track.folderName || "",
            relativePath: track.relativePath || track.fileName || track.name,
            sourcePath: track.sourcePath || "",
            file: track.file,
            url: URL.createObjectURL(track.file),
            color: track.color || "#f97316",
            duration: Number(track.duration) || 0,
            kind: track.kind || "track",
          };

          if (track.category === "effect") {
            nextEffects[track.slot ?? 0] = restored;
            return;
          }
          if (track.category === "intro") {
            nextIntro = restored;
            return;
          }
          if (track.category === "repeater") {
            restoredRepeaters.push({
              ...restored,
              minutes: Number(track.minutes) || 15,
              remaining: Math.max(1, Number(track.minutes) || 15) * 60,
              enabled: track.enabled !== false,
              gain: Number(track.gain) || Number(stateRef.current.repeaterVolume) || 1.15,
            });
            return;
          }
          if (track.category === "pisador") {
            restoredPisadores.push({
              ...restored,
              everyTracks: Number(track.everyTracks) || 2,
              position: track.position || "start",
              enabled: track.enabled !== false,
              gain: Number(track.gain) || 1,
            });
            return;
          }
          if (track.category === "background") {
            backgrounds.push(restored);
            return;
          }
          if (track.playlist === "program") {
            programming.push(restored);
            return;
          }
          general.push(restored);
        });

        setTracks(general);
        setBackgroundTracks(backgrounds);
        setProgramTracks(programming);
        setSelectedTrackId(general[0]?.id || backgrounds[0]?.id || "");
        setSelectedProgramTrackId(programming[0]?.id || "");
        setRepeaters(restoredRepeaters);
        setPisadores(restoredPisadores);
        setEffects(nextEffects);
        setIntroTrack(nextIntro);
        const total = general.length + backgrounds.length + programming.length;
        if (total) {
          setStatus(`${total} pista${total === 1 ? "" : "s"} restaurada${total === 1 ? "" : "s"} en la librería`);
        }
      })
      .catch(() => setStatus("Playlist lista. Si querés guardar audios, usá un navegador compatible."));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    isDuckedRef.current = isDucked;
    rampMainVolume(getMainTargetVolume(), isDucked ? 260 : 420);
  }, [isDucked, state.duckingVolume, state.mainVolume, state.radioVolume, playingType]);

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(floatingPanels));
    } catch {}
  }, [floatingPanels]);

  useEffect(() => {
    const handleMove = (event) => {
      const action = panelActionRef.current;
      if (!action || !workspaceRef.current) return;
      const minWidth = action.minWidth || 260;
      const minHeight = action.minHeight || 180;

      setFloatingPanels((prev) => {
        const current = prev[action.id];
        if (!current) return prev;
        const width = workspaceRef.current.clientWidth;
        const height = workspaceRef.current.clientHeight;
        if (action.mode === "move") {
          const nextX = Math.min(Math.max(0, event.clientX - action.rectLeft - action.offsetX), Math.max(0, width - current.w));
          const nextY = Math.min(Math.max(0, event.clientY - action.rectTop - action.offsetY), Math.max(0, height - current.h));
          return { ...prev, [action.id]: { ...current, x: nextX, y: nextY } };
        }

        const nextWidth = Math.min(width - current.x, Math.max(minWidth, action.startW + (event.clientX - action.startX)));
        const nextHeight = Math.min(height - current.y, Math.max(minHeight, action.startH + (event.clientY - action.startY)));
        return { ...prev, [action.id]: { ...current, w: nextWidth, h: nextHeight } };
      });
    };

    const stopAction = () => {
      panelActionRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", stopAction);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", stopAction);
    };
  }, []);

  useEffect(() => {
    applyAudioOutput(mainAudioRef.current);
    applyAudioOutput(overlayAudioRef.current);
    applyAudioOutput(micAudioRef.current);
  }, [state.outputDeviceId]);

  useEffect(() => {
    if (overlayGraphRef.current?.gain) {
      const kind =
        overlayKindRef.current === "repeater"
          ? Number(state.repeaterVolume)
          : overlayKindRef.current === "intro"
            ? Number(state.introVolume)
            : Number(state.effectVolume);
      overlayGraphRef.current.gain.gain.value = kind || 1;
    } else if (overlayAudioRef.current) {
      const kind =
        overlayKindRef.current === "repeater"
          ? Number(state.repeaterVolume)
          : overlayKindRef.current === "intro"
            ? Number(state.introVolume)
            : Number(state.effectVolume);
      overlayAudioRef.current.volume = Math.min(1, Math.max(0, kind || 1));
    }
  }, [state.effectVolume, state.introVolume, state.repeaterVolume]);

  useEffect(() => {
    return () => {
      tracksRef.current.forEach((track) => URL.revokeObjectURL(track.url));
      backgroundTracksRef.current.forEach((track) => URL.revokeObjectURL(track.url));
      programTracksRef.current.forEach((track) => URL.revokeObjectURL(track.url));
      repeatersRef.current.forEach((track) => URL.revokeObjectURL(track.url));
      pisadoresRef.current.forEach((track) => URL.revokeObjectURL(track.url));
      if (mainAudioRef.current) mainAudioRef.current.pause();
      if (overlayAudioRef.current) overlayAudioRef.current.pause();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((track) => track.stop());
      if (meterTimerRef.current) clearInterval(meterTimerRef.current);
      if (duckingTimerRef.current) clearInterval(duckingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    loadAudioDevices(false);

    const installHandler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const installedHandler = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setStatus("Radio Cast instalada");
    };

    window.addEventListener("beforeinstallprompt", installHandler);
    window.addEventListener("appinstalled", installedHandler);
    setIsInstalled(window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true);

    return () => {
      window.removeEventListener("beforeinstallprompt", installHandler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    loadAudioDevices(true);
  }, [settingsOpen]);

  useEffect(() => {
    if (!desktopApi?.getSettings) return;
    let cancelled = false;
    desktopApi
      .getSettings()
      .then((desktopSettings) => {
        if (cancelled || !desktopSettings) return;
        setState((prev) => ({
          ...prev,
          desktopCloseToTray: Boolean(desktopSettings.closeToTray),
          desktopAutoLaunch: Boolean(desktopSettings.autoLaunch),
          desktopMediaShortcuts: desktopSettings.mediaShortcuts !== false,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [desktopApi]);

  useEffect(() => {
    if (!desktopApi?.updateSettings) return;
    desktopApi.updateSettings({
      closeToTray: Boolean(state.desktopCloseToTray),
      autoLaunch: Boolean(state.desktopAutoLaunch),
      mediaShortcuts: Boolean(state.desktopMediaShortcuts),
    }).catch(() => {});
  }, [desktopApi, state.desktopAutoLaunch, state.desktopCloseToTray, state.desktopMediaShortcuts]);

  useEffect(() => {
    if (!desktopApi?.onCommand) return undefined;
    const dispose = desktopApi.onCommand((command) => {
      if (command === "toggle-play") togglePlayPause();
      else if (command === "next-track") playNextTrack();
      else if (command === "stop-main") stopMainAudio();
      else if (command === "toggle-ducking") toggleDucking();
      else if (command === "play-intro") playIntro();
    });
    return () => {
      if (typeof dispose === "function") dispose();
    };
  }, [desktopApi, isDucked, isMainPlaying, selectedTrackId, selectedProgramTrackId]);

  useEffect(() => {
    const timer = setInterval(() => {
      let dueRepeater = null;
      const overlayBusy = overlayAudioRef.current && !overlayAudioRef.current.paused;
      const nextRepeaters = repeatersRef.current.map((repeater) => {
        if (!repeater.enabled) return repeater;

        if (repeater.remaining <= 1) {
          if (!overlayBusy && !dueRepeater) {
            dueRepeater = repeater;
            return { ...repeater, remaining: repeater.minutes * 60 };
          }
          return { ...repeater, remaining: 1 };
        }

        return { ...repeater, remaining: repeater.remaining - 1 };
      });

      if (dueRepeater) {
        playOverlay(
          dueRepeater.url,
          `Repetición: ${dueRepeater.name}`,
          "repeater",
          dueRepeater.gain || stateRef.current.repeaterVolume
        );
      }
      setRepeaters(nextRepeaters);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const scheduledRadio = stateRef.current.radios.find(
        (radio) => radio.scheduleEnabled && isNowInRange(radio.startTime, radio.endTime)
      );

      if (scheduledRadio && schedulerRadioIdRef.current !== scheduledRadio.id) {
        schedulerRadioIdRef.current = scheduledRadio.id;
        playMain(scheduledRadio.url, `Radio programada: ${scheduledRadio.name}`, "radio programada");
        setStatus(`Radio programada activa hasta ${scheduledRadio.endTime}`);
        return;
      }

      if (!scheduledRadio && schedulerRadioIdRef.current) {
        schedulerRadioIdRef.current = "";
        const track = tracksRef.current.find((item) => item.id === selectedTrackIdRef.current) || tracksRef.current[0];
        if (track) {
          playTrack(track);
          setStatus("Terminó la radio programada. Sigue la playlist.");
        } else {
          stopMainAudio();
        }
      }
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!speechTimerRunning) return undefined;

    const timer = setInterval(() => {
      setSpeechTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setSpeechTimerRunning(false);
          setStatus("Terminó el tiempo de locución. Podés ir a la tanda musical.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [speechTimerRunning]);

  function updateNowPlaying(label) {
    setState((prev) => ({ ...prev, nowPlayingLabel: label }));
  }

  function updateStationField(field, value) {
    setState((prev) => ({ ...prev, [field]: value }));
  }

  async function fetchWeatherByCoords(latitude, longitude) {
    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`);
    const weatherData = await weatherResponse.json();
    const current = weatherData?.current_weather;
    if (!current) throw new Error("Sin datos");
    return {
      text: WEATHER_CODE_LABELS[current.weathercode] || "Tiempo actual",
      temperature: `${Math.round(current.temperature)}°C`,
    };
  }

  async function searchCityClimate() {
    const city = String(stationDraft.stationCity || "").trim();
    if (!city) {
      setStatus("Escribí una ciudad para buscar el clima");
      return;
    }

    setCitySearchLoading(true);
    setDraftWeatherInfo({ text: "", temperature: "", loading: true });
    try {
      const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=es&format=json`);
      const geoData = await geoResponse.json();
      const results = (geoData?.results || []).map((item) => ({
        id: `${item.id || item.latitude}-${item.longitude}`,
        name: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
        city: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
      }));
      setCityMatches(results);
      if (!results.length) {
        setDraftWeatherInfo({ text: "Ciudad no encontrada", temperature: "", loading: false });
        setStatus("No encontré esa ciudad");
        return;
      }
      const preview = await fetchWeatherByCoords(results[0].latitude, results[0].longitude);
      setDraftWeatherInfo({ ...preview, loading: false });
      setStatus("Elegí una ciudad de la lista para guardar el clima");
    } catch {
      setDraftWeatherInfo({ text: "Clima no disponible", temperature: "", loading: false });
      setStatus("No se pudo buscar la ciudad");
    } finally {
      setCitySearchLoading(false);
    }
  }

  async function chooseCityMatch(match) {
    setStationDraft((prev) => ({ ...prev, stationCity: match.city }));
    setCityMatches([match]);
    setDraftWeatherInfo((prev) => ({ ...prev, loading: true }));
    try {
      const preview = await fetchWeatherByCoords(match.latitude, match.longitude);
      setDraftWeatherInfo({ ...preview, loading: false });
      setStatus(`Ciudad seleccionada: ${match.name}`);
    } catch {
      setDraftWeatherInfo({ text: "Clima no disponible", temperature: "", loading: false });
    }
  }

  function applyStationDraft() {
    setState((prev) => ({
      ...prev,
      stationName: String(stationDraft.stationName || "").trim() || "Radio Cast",
      stationSlogan: String(stationDraft.stationSlogan || "").trim(),
      stationDetails: String(stationDraft.stationDetails || "").trim(),
      stationCity: String(stationDraft.stationCity || "").trim(),
      stationLogo: stationDraft.stationLogo || "",
    }));
    setStatus("Datos de la radio guardados");
  }

  function updateSetting(field, value) {
    setState((prev) => ({ ...prev, [field]: value }));
  }

  function setSpeechPreset(minutes) {
    const safeMinutes = Math.max(1, Math.min(240, Number(minutes) || 1));
    setSpeechTimerMinutes(safeMinutes);
    if (!speechTimerRunning) setSpeechTimerRemaining(safeMinutes * 60);
  }

  function startSpeechTimer(minutes = speechTimerMinutes) {
    const safeMinutes = Math.max(1, Math.min(240, Number(minutes) || 1));
    setSpeechTimerMinutes(safeMinutes);
    setSpeechTimerRemaining(safeMinutes * 60);
    setSpeechTimerRunning(true);
    setStatus(`Locución en cuenta regresiva: ${safeMinutes} min`);
  }

  function pauseSpeechTimer() {
    setSpeechTimerRunning(false);
    setStatus("Locución pausada");
  }

  function resetSpeechTimer() {
    setSpeechTimerRunning(false);
    setSpeechTimerRemaining(Math.max(1, Number(speechTimerMinutes) || 1) * 60);
    setStatus("Reloj de locución reiniciado");
  }

  function getMainTargetVolume(type = mainTypeRef.current) {
    const master = Math.max(0, Math.min(1, Number(stateRef.current.mainVolume) || 0));
    if (isDuckedRef.current) return Math.max(0, Math.min(1, master * Number(stateRef.current.duckingVolume || 0)));
    if (String(type).includes("radio")) return Math.max(0, Math.min(1, master * Number(stateRef.current.radioVolume || 1)));
    if (String(type).includes("program")) return Math.max(0, Math.min(1, master * Number(stateRef.current.programVolume || 1)));
    return master;
  }

  function setMainFaderVolume(value) {
    const numeric = Math.max(0, Math.min(1, Number(value) || 0));
    updateSetting("mainVolume", numeric);
    if (mainAudioRef.current) {
      const target =
        isDuckedRef.current
          ? numeric * Number(stateRef.current.duckingVolume || 0)
          : String(mainTypeRef.current).includes("radio")
            ? numeric * Number(stateRef.current.radioVolume || 1)
            : String(mainTypeRef.current).includes("program")
              ? numeric * Number(stateRef.current.programVolume || 1)
              : numeric;
      mainAudioRef.current.volume = Math.max(0, Math.min(1, target));
    }
  }

  function rampMainVolume(target, durationMs = 320) {
    if (!mainAudioRef.current) return;
    if (duckingTimerRef.current) clearInterval(duckingTimerRef.current);

    const audio = mainAudioRef.current;
    const start = Number(audio.volume || 0);
    const end = Math.max(0, Math.min(1, Number(target) || 0));
    const steps = 12;
    let step = 0;

    duckingTimerRef.current = setInterval(() => {
      step += 1;
      const progress = step / steps;
      audio.volume = start + (end - start) * progress;
      if (step >= steps) {
        audio.volume = end;
        clearInterval(duckingTimerRef.current);
        duckingTimerRef.current = null;
      }
    }, Math.max(16, Math.round(durationMs / steps)));
  }

  function applyAudioOutput(audio) {
    if (!audio || !stateRef.current.outputDeviceId || typeof audio.setSinkId !== "function") return;
    audio.setSinkId(stateRef.current.outputDeviceId).catch(() => {
      setState((prev) => ({ ...prev, outputDeviceId: "" }));
      setStatus("Este navegador no pudo cambiar la salida de audio");
    });
  }

  function configureOverlayGain(audio, gainValue) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const context = audioContextRef.current;
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      gain.gain.value = Number(gainValue) || 1;
      source.connect(gain);
      gain.connect(context.destination);
      overlayGraphRef.current = { source, gain };
      if (context.state === "suspended") context.resume();
    } catch {
      audio.volume = Math.min(1, Math.max(0, Number(gainValue) || 1));
    }
  }

  function attachMeter(audio, targetRef) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const captureStream = audio.captureStream?.bind(audio) || audio.mozCaptureStream?.bind(audio);
      if (!AudioContextClass || !captureStream) {
        targetRef.current = null;
        return;
      }

      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const context = audioContextRef.current;
      const stream = captureStream();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      targetRef.current = {
        source,
        analyser,
        timeData: new Uint8Array(analyser.fftSize),
        freqData: new Uint8Array(analyser.frequencyBinCount),
        audio,
      };
      if (context.state === "suspended") context.resume();
    } catch {
      targetRef.current = null;
    }
  }

  function readStereoLevels(targetRef, fallback = 0) {
    const dynamicLevels = (level) => {
      const phaseBase = (targetRef.current?.audio?.currentTime || 0) * 6.4 + performance.now() / 190;
      const safe = Math.min(1, Math.max(0, level || 0));
      const base = Math.max(0.035, safe * 0.56);
      const motion = 0.88 + Math.abs(Math.sin(phaseBase)) * 0.08;
      const levelNow = Math.min(1, base * motion);
      return [levelNow, levelNow];
    };

    const graph = targetRef.current;
    if (!graph?.analyser || !graph.timeData || !graph.freqData) {
      return dynamicLevels(fallback);
    }

    graph.analyser.getByteTimeDomainData(graph.timeData);
    graph.analyser.getByteFrequencyData(graph.freqData);
    let timeEnergy = 0;

    for (let index = 0; index < graph.timeData.length; index += 1) {
      const normalized = (graph.timeData[index] - 128) / 128;
      timeEnergy += normalized * normalized;
    }

    let freqEnergy = 0;
    for (let index = 0; index < graph.freqData.length; index += 1) {
      freqEnergy += graph.freqData[index] / 255;
    }

    const rms = Math.sqrt(timeEnergy / graph.timeData.length);
    const spectral = freqEnergy / graph.freqData.length;
    const analyzedBase = Math.max(rms * 2.1, spectral * 0.82);
    const analyzed = Math.pow(Math.min(1, analyzedBase), 1.08);
    const fallbackSafe = Math.min(1, Math.max(0, fallback || 0));
    const combined = Math.max(analyzed, fallbackSafe * 0.24);
    if (combined < 0.035 && fallbackSafe > 0.02) {
      return dynamicLevels(fallbackSafe);
    }
    return [combined, combined];
  }

  async function loadAudioDevices(requestPermission = true) {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setStatus("Este navegador no permite listar placas de audio");
      return;
    }

    try {
      if (requestPermission && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioOutputs(devices.filter((device) => device.kind === "audiooutput"));
      setAudioInputs(devices.filter((device) => device.kind === "audioinput"));
      if (requestPermission) setStatus("Dispositivos de audio actualizados");
    } catch {
      setStatus("No se pudo acceder a los dispositivos de audio");
    }
  }

  async function enableMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Este navegador no permite usar micrófono");
      return;
    }

    try {
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((track) => track.stop());
      const constraints = {
        audio: state.inputDeviceId ? { deviceId: { exact: state.inputDeviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      if (!micAudioRef.current) micAudioRef.current = new Audio();
      micAudioRef.current.srcObject = stream;
      micAudioRef.current.muted = true;
      applyAudioOutput(micAudioRef.current);
      setStatus("Micrófono habilitado para locución");
      await loadAudioDevices(false);
    } catch {
      setStatus("No se pudo habilitar el micrófono");
    }
  }

  async function installApp() {
    if (isInstalled) {
      setStatus("Radio Cast ya está instalada");
      return;
    }

    if (!installPrompt) {
      setStatus("Si no aparece el instalador, usá el menú del navegador: Instalar app o Agregar a pantalla de inicio.");
      return;
    }

    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function startMeter() {
    if (meterTimerRef.current) clearInterval(meterTimerRef.current);
    meterTimerRef.current = setInterval(() => {
      const mainActive = mainAudioRef.current && !mainAudioRef.current.paused;
      const levels = mainActive ? readStereoLevels(mainMeterRef, Number(mainAudioRef.current?.volume || 0)) : [0, 0];
      const previousPeaks = vuPeakStateRef.current.main || [0, 0];
      const nextPeaks = levels.map((level, index) => {
        const currentPeak = Number(previousPeaks[index] || 0);
        if (level >= currentPeak) return level;
        return Math.max(level, currentPeak - 0.028);
      });
      vuPeakStateRef.current.main = nextPeaks;

      setVuMeters({
        main: {
          levels,
          peaks: nextPeaks,
        },
      });
    }, 90);
  }

  function stopMeterIfSilent() {
    if (mainAudioRef.current && !mainAudioRef.current.paused) return;
    if (overlayAudioRef.current && !overlayAudioRef.current.paused) return;
    if (meterTimerRef.current) clearInterval(meterTimerRef.current);
    meterTimerRef.current = null;
    mainMeterRef.current = null;
    overlayMeterRef.current = null;
    vuPeakStateRef.current = { main: [0, 0] };
    setVuMeters({
      main: {
        levels: [0, 0],
        peaks: [0, 0],
      },
    });
  }

  async function savePlaylistNow() {
    try {
      await deleteTracksByCategory("track");
      await deleteTracksByCategory("background");
      await deleteTracksByCategory("program-separator");
      await deleteTracksByCategory("pisador");
      await Promise.all(
        [
          ...tracks.map((track) => ({ ...track, playlist: "general", category: "track" })),
          ...backgroundTracks.map((track) => ({ ...track, playlist: "background", category: "background" })),
          ...programTracks.map((track) => ({ ...track, playlist: "program", category: "track" })),
          ...pisadores.map((track) => ({ ...track, category: "pisador" })),
        ].map((track) =>
          track.kind === "separator"
            ? putSavedTrack({
                id: track.id,
                name: track.name,
                blockName: track.blockName,
                afterAction: track.afterAction,
                playlist: "program",
                category: "program-separator",
              })
            : track.category === "pisador" && track.file
            ? putSavedTrack({
                id: track.id,
                name: track.name,
                fileName: track.fileName,
                file: track.file,
                category: "pisador",
                everyTracks: track.everyTracks,
                position: track.position,
                enabled: track.enabled,
                gain: track.gain,
                folderName: track.folderName,
                relativePath: track.relativePath,
                sourcePath: track.sourcePath,
              })
            : track.file
            ? putSavedTrack({
                id: track.id,
                name: track.name,
                fileName: track.fileName,
                file: track.file,
                playlist: track.playlist,
                category: track.category,
                duration: track.duration,
                folderName: track.folderName,
                relativePath: track.relativePath,
                sourcePath: track.sourcePath,
              })
            : Promise.resolve()
        )
      );
      setStatus("Playlists guardadas en este navegador");
    } catch {
      setStatus("No se pudo guardar la playlist. Puede faltar espacio en el navegador.");
    }
  }

  async function exportPlaylistM3U() {
    const visibleTracks =
      playlistTab === "background"
        ? backgroundTracks
        : playlistTab === "featured"
          ? tracks.filter((track) => state.featuredTrackIds.includes(track.id))
          : tracks;

    const audioTracks = visibleTracks.filter((track) => track.kind !== "separator");
    if (!audioTracks.length) {
      setStatus("No hay pistas para exportar en esta vista");
      return;
    }

    const lines = ["#EXTM3U"];
    audioTracks.forEach((track) => {
      const seconds = Math.max(0, Math.round(Number(track.duration) || 0));
      const entryPath =
        track.sourcePath ||
        track.relativePath ||
        (track.folderName ? `${track.folderName}/${track.fileName || track.name}` : track.fileName || track.name);
      lines.push(`#EXTINF:${seconds},${track.name}`);
      lines.push(entryPath);
    });

    const playlistName =
      playlistTab === "background"
        ? "fondos"
        : playlistTab === "featured"
          ? "destacadas"
          : "playlist";
    const content = lines.join("\n");
    if (desktopApi?.saveTextFile) {
      try {
        const result = await desktopApi.saveTextFile({
          title: "Guardar playlist M3U",
          defaultPath: `radio-cast-${playlistName}.m3u`,
          filters: [{ name: "Playlist M3U", extensions: ["m3u"] }],
          content,
        });
        if (!result?.canceled) {
          setStatus(`Playlist exportada en M3U: ${playlistName}`);
          return;
        }
      } catch {
        setStatus("No se pudo exportar la playlist M3U");
        return;
      }
    }
    const blob = new Blob([content], { type: "audio/x-mpegurl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `radio-cast-${playlistName}.m3u`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    setStatus(`Playlist exportada en M3U: ${playlistName}`);
  }

  function uploadStationLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Seleccioná una imagen para el logo");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setStationDraft((prev) => ({ ...prev, stationLogo: String(reader.result || "") }));
      setStatus("Logo listo para guardar");
    };
    reader.onerror = () => setStatus("No se pudo cargar el logo");
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function syncMainProgress(audio) {
    setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
  }

  function seekMainAudio(event) {
    const nextTime = Number(event.target.value);
    if (!seekEnabled || !mainAudioRef.current) return;

    mainAudioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function playMain(url, label, type, onEnded, options = {}) {
    if (!url) {
      setStatus("No hay audio para reproducir");
      return;
    }

    stopOverlay(false);
    if (mainAudioRef.current) mainAudioRef.current.pause();

    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.muted = false;
    audio.playsInline = true;
    mainTypeRef.current = type;
    audio.volume = getMainTargetVolume(type);
    applyAudioOutput(audio);
    audio.onplay = () => {
      attachMeter(audio, mainMeterRef);
      setIsMainPlaying(true);
      startMeter();
    };
    audio.onpause = () => {
      setIsMainPlaying(false);
      stopMeterIfSilent();
    };
    let queuedAdvance = false;
    audio.onloadedmetadata = () => {
      syncMainProgress(audio);
      if (options.trimStart) audio.currentTime = options.trimStart;
    };
    audio.ondurationchange = () => syncMainProgress(audio);
    audio.onerror = () => {
      setIsMainPlaying(false);
      setStatus(`No se pudo abrir la fuente: ${label}`);
    };
    audio.onstalled = () => {
      setStatus(`La señal está cargando: ${label}`);
    };
    audio.ontimeupdate = () => {
      syncMainProgress(audio);
      if (!onEnded || queuedAdvance || !Number.isFinite(audio.duration)) return;
      const lead = Math.max(0.04, Number(options.trimEnd || 0));
      if (audio.currentTime >= Math.max(0, audio.duration - lead)) {
        queuedAdvance = true;
        audio.pause();
        onEnded();
      }
    };
    audio.onended = () => {
      setIsMainPlaying(false);
      setCurrentTime(0);
      stopMeterIfSilent();
      if (onEnded) onEnded();
    };
    audio.load();
    audio.play()
      .then(() => setStatus("Reproduciendo"))
      .catch(() => {
        setIsMainPlaying(false);
        setStatus(`No se pudo reproducir: ${label}`);
      });

    mainAudioRef.current = audio;
    mainLabelRef.current = label;
    setCurrentTime(0);
    setDuration(0);
    setPlayingType(type);
    updateNowPlaying(label);
  }

  function getDuePisador(position, trackCount) {
    return pisadoresRef.current.find(
      (item) =>
        item.enabled &&
        (item.position === position || item.position === "both") &&
        trackCount > 0 &&
        trackCount % Math.max(1, Number(item.everyTracks) || 1) === 0
    );
  }

  function playTrack(track = selectedTrack, playlist = "general", options = {}) {
    if (!track) {
      setStatus("Cargá pistas MP3 primero");
      return;
    }
    if (track.kind === "separator") {
      setStatus("Ese separador no se reproduce");
      return;
    }

    schedulerRadioIdRef.current = "";
    if (playlist === "program") {
      setSelectedProgramTrackId(track.id);
      playMain(
        track.url,
        `Programación: ${track.name}`,
        "program playlist",
        () => playNextTrack(track.id, "program"),
        { trimStart: track.trimStart, trimEnd: track.trimEnd }
      );
      return;
    }

    setSelectedTrackId(track.id);
    let currentCount = playlistTrackCounterRef.current;
    if (!options.skipTrackCountIncrement) {
      currentCount += 1;
      playlistTrackCounterRef.current = currentCount;
    }
    playMain(
      track.url,
      `Pista: ${track.name}`,
      "playlist",
      () => playNextTrack(track.id, "general"),
      { trimStart: track.trimStart, trimEnd: track.trimEnd }
    );
    if (!options.skipPisadorCheck) {
      const duePisador = getDuePisador("start", currentCount);
      if (duePisador) {
        playOverlay(duePisador.url, `Pisador: ${duePisador.name}`, "pisador", duePisador.gain || 1);
      }
    }
  }

  function playNextTrack(currentId = selectedTrackIdRef.current, playlist = String(mainTypeRef.current).includes("program") ? "program" : "general") {
    const list = playlist === "program" ? programTracksRef.current : tracksRef.current;
    if (!list.length) {
      setStatus("No hay pistas cargadas");
      return;
    }

    if (playlist === "program") {
      const blocks = buildProgramBlocks(list);
      const currentBlockIndex = blocks.findIndex((block) => block.tracks.some((track) => track.id === currentId));
      if (currentBlockIndex === -1) {
        setStatus("No se encontró la pista dentro de programación");
        return;
      }

      const currentBlock = blocks[currentBlockIndex];
      const trackIndex = currentBlock.tracks.findIndex((track) => track.id === currentId);
      const nextTrackInBlock = currentBlock.tracks[trackIndex + 1];

      if (nextTrackInBlock) {
        playTrack(nextTrackInBlock, "program");
        return;
      }

      if (currentBlock.afterAction === "background") {
        const fondo = backgroundTracksRef.current.find((track) => track.kind !== "separator");
        if (fondo) {
          playTrack(fondo, "general");
          setStatus(`Fin de ${currentBlock.label}. Salta a fondos.`);
          return;
        }
      }

      if (currentBlock.afterAction === "general") {
        const general = tracksRef.current.find((track) => track.kind !== "separator");
        if (general) {
          playTrack(general, "general");
          setStatus(`Fin de ${currentBlock.label}. Salta a playlist general.`);
          return;
        }
      }

      const nextTrack = blocks.slice(currentBlockIndex + 1).flatMap((block) => block.tracks)[0];
      if (nextTrack) {
        playTrack(nextTrack, "program");
        return;
      }

      setStatus("Terminó la programación");
      stopMainAudio();
      return;
    }

    const mode = stateRef.current.playlistMode;
    const currentIndex = Math.max(0, list.findIndex((track) => track.id === currentId));
    let nextTrack = list[(currentIndex + 1) % list.length];

    if (mode === "random" && list.length > 1) {
      const available = list.filter((track) => track.id !== currentId);
      nextTrack = available[Math.floor(Math.random() * available.length)];
    }

    const duePisador = getDuePisador("end", playlistTrackCounterRef.current);
    if (duePisador && nextTrack) {
      pendingAfterOverlayRef.current = () => playTrack(nextTrack, playlist, { skipPisadorCheck: false, skipTrackCountIncrement: false });
      playOverlay(duePisador.url, `Pisador: ${duePisador.name}`, "pisador", duePisador.gain || 1);
      return;
    }

    playTrack(nextTrack, playlist);
  }

  function togglePlayPause() {
    if (!mainAudioRef.current) {
      playTrack();
      return;
    }

    if (mainAudioRef.current.paused) {
      mainAudioRef.current.play().then(startMeter).catch(() => setStatus("No se pudo reanudar el audio"));
      setStatus("Reproduciendo");
    } else {
      mainAudioRef.current.pause();
      setStatus("Pausado");
    }
  }

  function stopMainAudio() {
    if (mainAudioRef.current) {
      mainAudioRef.current.pause();
      mainAudioRef.current.currentTime = 0;
    }
    mainMeterRef.current = null;
    setIsMainPlaying(false);
    setPlayingType("detenido");
    setCurrentTime(0);
    setDuration(0);
    mainLabelRef.current = "Nada reproduciéndose";
    updateNowPlaying("Nada reproduciéndose");
    stopMeterIfSilent();
    setStatus("Detenido");
  }

  function playOverlay(
    url,
    label,
    kind = "effect",
    gainValue = kind === "repeater"
      ? stateRef.current.repeaterVolume
      : kind === "intro"
        ? stateRef.current.introVolume
        : stateRef.current.effectVolume
  ) {
    if (!url) {
      setStatus("No hay audio para lanzar");
      return;
    }

    if (
      (kind === "effect" || kind === "pisador") &&
      overlayAudioRef.current &&
      !overlayAudioRef.current.paused &&
      overlayKindRef.current === kind &&
      overlayLabelRef.current === label
    ) {
      stopOverlay();
      return;
    }

    stopOverlay();

    if (mainAudioRef.current && !mainAudioRef.current.paused) {
      rampMainVolume(Number(stateRef.current.duckingVolume), 180);
    }

    const overlay = new Audio(url);
    overlay.volume = 1;
    applyAudioOutput(overlay);
    overlayKindRef.current = kind;
    overlayLabelRef.current = label;
    configureOverlayGain(overlay, gainValue);
    overlay.onplay = () => {
      attachMeter(overlay, overlayMeterRef);
      setIsOverlayPlaying(true);
      startMeter();
    };
    overlay.onpause = () => {
      setIsOverlayPlaying(false);
      stopMeterIfSilent();
    };
    overlay.onended = () => stopOverlay(false);
    overlay.play().catch(() => setStatus(`No se pudo lanzar: ${label}`));

    overlayAudioRef.current = overlay;
    updateNowPlaying(label);
    setStatus(
      kind === "effect"
        ? "Efecto en reproducción"
        : kind === "pisador"
          ? "Pisador en reproducción"
          : kind === "repeater"
            ? "Repetición en reproducción"
            : "Audio auxiliar en reproducción"
    );
  }

  function stopOverlay(updateStatus = true) {
    if (overlayAudioRef.current) {
      overlayAudioRef.current.pause();
      overlayAudioRef.current.currentTime = 0;
      overlayAudioRef.current = null;
    }
    overlayGraphRef.current = null;
    overlayKindRef.current = "";
    overlayLabelRef.current = "";
    overlayMeterRef.current = null;
    rampMainVolume(getMainTargetVolume(), 220);
    setIsOverlayPlaying(false);
    updateNowPlaying(mainAudioRef.current ? mainLabelRef.current : "Nada reproduciéndose");
    stopMeterIfSilent();
    const pendingAction = pendingAfterOverlayRef.current;
    pendingAfterOverlayRef.current = null;
    if (updateStatus) setStatus("Audio auxiliar detenido");
    if (pendingAction) {
      setTimeout(() => pendingAction(), 20);
    }
  }

  function startDucking() {
    setIsDucked(true);
    setStatus("Locución activa: música atenuada");
  }

  function stopDucking() {
    setIsDucked(false);
    setStatus("Locución finalizada");
  }

  function toggleDucking() {
    if (isDuckedRef.current) {
      stopDucking();
    } else {
      startDucking();
    }
  }

  function sendTrackToProgram(track) {
    if (!track) return;
    insertTrackIntoProgram(track);
  }

  function insertTrackIntoProgram(track, targetId = null, placement = "end") {
    if (!track) return;
    const nextId = crypto.randomUUID();
    const copy = {
      ...track,
      id: nextId,
      kind: "track",
    };
    setProgramTracks((prev) => {
      const next = [...prev];
      let insertIndex = next.length;
      if (targetId) {
        const targetIndex = next.findIndex((item) => item.id === targetId);
        if (targetIndex !== -1) insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
      }
      next.splice(insertIndex, 0, copy);
      return next;
    });
    setSelectedProgramTrackId(copy.id);
    putSavedTrack({
      id: copy.id,
      name: copy.name,
      fileName: copy.fileName,
      file: copy.file,
      playlist: "program",
      category: "track",
      duration: copy.duration,
      folderName: copy.folderName,
      relativePath: copy.relativePath,
      sourcePath: copy.sourcePath,
    }).catch(() => {});
    setStatus(`Enviado a programación: ${track.name}`);
  }

  function handleProgramDrop(event, targetId = null, placement = "end") {
    event.preventDefault();
    setProgramDropActive(false);
    try {
      const raw = event.dataTransfer.getData("text/radiocast-track") || event.dataTransfer.getData("text/plain");
      const data = JSON.parse(raw);
      if (data.listType === "program") {
        moveProgramTrackTo(data.id, targetId, placement);
        return;
      }
      const sourceTrack = [...tracks, ...backgroundTracks].find((item) => item.id === data.id);
      if (sourceTrack) insertTrackIntoProgram(sourceTrack, targetId, placement);
    } catch {
      setStatus("No se pudo arrastrar la pista a programación");
    }
  }

  function moveProgramItem(id, direction) {
    setProgramTracks((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  function moveProgramTrackTo(id, targetId = null, placement = "end") {
    if (!id) return;
    setProgramTracks((prev) => {
      const currentIndex = prev.findIndex((item) => item.id === id);
      if (currentIndex === -1) return prev;
      const moving = prev[currentIndex];
      const next = prev.filter((item) => item.id !== id);
      let insertIndex = next.length;
      if (targetId) {
        const targetIndex = next.findIndex((item) => item.id === targetId);
        if (targetIndex !== -1) insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
      }
      next.splice(insertIndex, 0, moving);
      return next;
    });
  }

  function insertProgramSeparator(afterId) {
    let created = null;
    setProgramTracks((prev) => {
      const nextIndex = Math.max(0, prev.findIndex((item) => item.id === afterId));
      if (prev[nextIndex + 1]?.kind === "separator") return prev;
      const blockNumber = prev.slice(0, nextIndex + 1).filter((item) => item.kind === "separator").length + 1;
      created = {
        id: `separator-${crypto.randomUUID()}`,
        kind: "separator",
        name: `Separador ${blockNumber}`,
        blockName: `Bloque ${blockNumber}`,
        afterAction: "continue",
      };
      const next = [...prev];
      next.splice(nextIndex + 1, 0, created);
      return next;
    });
    if (created) {
      putSavedTrack({
        id: created.id,
        name: created.name,
        blockName: created.blockName,
        afterAction: created.afterAction,
        playlist: "program",
        category: "program-separator",
      }).catch(() => {});
      setStatus("Separador agregado en programación");
    }
  }

  function updateProgramSeparator(id, patch) {
    setProgramTracks((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.kind !== "separator") return item;
        const nextItem = { ...item, ...patch };
        putSavedTrack({
          id: nextItem.id,
          name: nextItem.name,
          blockName: nextItem.blockName,
          afterAction: nextItem.afterAction,
          playlist: "program",
          category: "program-separator",
        }).catch(() => {});
        return nextItem;
      })
    );
  }

  function updateProgramBlock(block, patch) {
    if (block.separatorId) {
      updateProgramSeparator(block.separatorId, patch);
      return;
    }

    const lastTrackId = block.tracks[block.tracks.length - 1]?.id;
    if (!lastTrackId) return;

    let created = null;
    setProgramTracks((prev) => {
      const nextIndex = prev.findIndex((item) => item.id === lastTrackId);
      if (nextIndex === -1) return prev;
      created = {
        id: `separator-${crypto.randomUUID()}`,
        kind: "separator",
        name: patch.blockName || block.label,
        blockName: patch.blockName || block.label,
        afterAction: patch.afterAction || block.afterAction || "continue",
      };
      const next = [...prev];
      next.splice(nextIndex + 1, 0, created);
      return next;
    });

    if (created) {
      putSavedTrack({
        id: created.id,
        name: created.name,
        blockName: created.blockName,
        afterAction: created.afterAction,
        playlist: "program",
        category: "program-separator",
      }).catch(() => {});
    }
  }

  function commitProgramBlockName(block) {
    const key = block.separatorId || block.id;
    const draft = String(programBlockDrafts[key] ?? block.label).trim();
    if (!draft || draft === block.label) return;
    updateProgramBlock(block, { blockName: draft });
  }

  function isTrackPlaying(trackId, playlist = "general") {
    if (!mainAudioRef.current || mainAudioRef.current.paused) return false;
    if (playlist === "program") return String(playingType).includes("program") && selectedProgramTrackId === trackId;
    return !String(playingType).includes("program") && selectedTrackId === trackId;
  }

  function toggleFeaturedTrack(trackId) {
    setState((prev) => ({
      ...prev,
      featuredTrackIds: prev.featuredTrackIds.includes(trackId)
        ? prev.featuredTrackIds.filter((id) => id !== trackId)
        : [...prev.featuredTrackIds, trackId],
    }));
  }

  function openTrackMenu(event, track, listType = "general") {
    event.preventDefault();
    if (listType === "program") setSelectedProgramTrackId(track.id);
    else setSelectedTrackId(track.id);
    setTrackMenu({ x: event.clientX, y: event.clientY, trackId: track.id, listType });
  }

  function renderStereoVu(meter) {
    const levels = meter?.levels || [0, 0];
    const peaks = meter?.peaks || [0, 0];
    return (
      <div className="grid gap-1 rounded-lg border border-slate-700 bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
          <span>L</span>
          <span>Vu</span>
          <span>R</span>
        </div>
        <div className="flex h-36 items-end gap-2">
        {levels.map((level, channel) => {
          const safeLevel = Math.min(1, Math.max(0, level || 0));
          const safePeak = Math.min(1, Math.max(0, peaks[channel] || 0));
          const peak = Math.max(0, safeLevel * 100);
          const hold = Math.max(0, safePeak * 100);
          return (
            <div key={channel} className="relative flex h-full w-7 flex-col-reverse gap-[2px] rounded-md bg-slate-950/90 p-[3px] ring-1 ring-white/5">
              {Array.from({ length: 26 }).map((_, index) => {
                const threshold = ((index + 1) / 26) * 100;
                const active = peak >= threshold;
                const color = index >= 22 ? "bg-red-500" : index >= 16 ? "bg-yellow-400" : "bg-emerald-400";
                return <div key={index} className={`h-full rounded-[2px] transition-colors duration-75 ${active ? `${color} shadow-[0_0_8px_rgba(255,255,255,0.12)]` : "bg-slate-800/90"}`} />;
              })}
              <div
                className="pointer-events-none absolute inset-x-1 h-[2px] rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-[bottom] duration-100"
                style={{ bottom: `calc(${Math.max(4, hold)}% - 1px)` }}
              />
            </div>
          );
        })}
        </div>
      </div>
    );
  }

  function renderVerticalFader(value, onChange, max = 1) {
    const safeValue = Math.max(0, Math.min(max, Number(value) || 0));
    const percent = Math.round((safeValue / max) * 100);
    return (
      <div className="grid justify-items-center gap-1">
        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Fader</div>
        <div className="text-[10px] font-black text-slate-300">{percent}%</div>
        <div className="relative flex h-36 w-[72px] items-center justify-center rounded-lg border border-slate-700 bg-[linear-gradient(180deg,#0f172a_0%,#020617_100%)] px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="pointer-events-none absolute inset-y-3 left-1/2 flex -translate-x-1/2 flex-col justify-between">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="block h-[1px] w-7 rounded-full bg-slate-500/60" />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-3 left-1/2 w-8 -translate-x-1/2">
            <div className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 overflow-hidden rounded-full bg-slate-800 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              <div
                className="absolute inset-x-0 bottom-0 rounded-full bg-orange-500/95 shadow-[0_0_14px_rgba(249,115,22,0.55)]"
                style={{ height: `${Math.max(8, percent)}%` }}
              />
            </div>
            <div
              className="absolute left-1/2 h-4 w-8 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
              style={{ top: `${100 - percent}%` }}
            />
          </div>
          <input
            type="range"
            min="0"
            max={max}
            step="0.01"
            value={safeValue}
            onChange={onChange}
            className="h-32 w-12 cursor-pointer opacity-0"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
        </div>
      </div>
    );
  }

  function resetPanelLayout() {
    setFloatingPanels(DEFAULT_FLOATING_PANELS);
    setPanelOrder(["playlist", "program", "repeaters", "radios", "effects", "lead", "pisadores"]);
    setPanelPrefs(Object.fromEntries(Object.keys(PANEL_LABELS).map((id) => [id, { visible: true, pinned: false }])));
    setStatus("Layout restablecido");
  }

  async function analyzeTrackSilence(file) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return { trimStart: 0, trimEnd: 0.08, duration: 0 };
      if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
      const buffer = await file.arrayBuffer();
      const decoded = await audioContextRef.current.decodeAudioData(buffer.slice(0));
      if (!stateRef.current.trimSilence) return { trimStart: 0, trimEnd: 0.08, duration: decoded.duration };
      const samples = decoded.getChannelData(0);
      const threshold = 0.015;
      let startIndex = 0;
      let endIndex = samples.length - 1;

      while (startIndex < samples.length && Math.abs(samples[startIndex]) < threshold) startIndex += 1;
      while (endIndex > startIndex && Math.abs(samples[endIndex]) < threshold) endIndex -= 1;

      const trimStart = Math.min(startIndex / decoded.sampleRate, 2.5);
      const trailingSilence = Math.max(0, decoded.duration - endIndex / decoded.sampleRate);
      const trimEnd = Math.min(trailingSilence, 2.5);
      return { trimStart, trimEnd, duration: decoded.duration };
    } catch {
      return { trimStart: 0, trimEnd: 0.08, duration: 0 };
    }
  }

  function buildTrackEntries(audioFiles) {
    return audioFiles.map((item) => {
      const file = item.file || item;
      return {
        id: crypto.randomUUID(),
        name: (item.name || file.name || "Audio").replace(/\.[^/.]+$/, ""),
        fileName: item.fileName || file.name,
        file,
        folderName: item.folderName || (file.webkitRelativePath ? file.webkitRelativePath.split("/")[0] : ""),
        relativePath: item.relativePath || file.webkitRelativePath || file.name,
        sourcePath: item.sourcePath || item.path || "",
        url: URL.createObjectURL(file),
        trimStart: 0,
        trimEnd: 0.08,
        duration: 0,
        kind: "track",
      };
    });
  }

  function appendTracksToPlaylist(audioFiles, playlist = "general") {
    if (!audioFiles.length) {
      setStatus("Seleccioná archivos MP3 u otros audios");
      return;
    }

    const nextTracks = buildTrackEntries(audioFiles);

    if (playlist === "program") {
      setProgramTracks((prev) => {
        const next = stateRef.current.mixFoldersOnLoad ? interleaveArrays(prev, nextTracks) : [...prev, ...nextTracks];
        if (!selectedProgramTrackIdRef.current) setSelectedProgramTrackId(nextTracks[0].id);
        return next;
      });
    } else if (playlist === "background") {
      setBackgroundTracks((prev) => {
        const next = [...prev, ...nextTracks];
        if (!selectedTrackIdRef.current) setSelectedTrackId(nextTracks[0].id);
        return next;
      });
    } else {
      setTracks((prev) => {
        const next = stateRef.current.mixFoldersOnLoad ? interleaveArrays(prev, nextTracks) : [...prev, ...nextTracks];
        if (!selectedTrackIdRef.current) setSelectedTrackId(nextTracks[0].id);
        return next;
      });
    }

    nextTracks.forEach((track) => {
      analyzeTrackSilence(track.file).then((analysis) => {
        const updater = (prev) => prev.map((item) => (item.id === track.id ? { ...item, ...analysis } : item));
        if (playlist === "program") setProgramTracks(updater);
        else if (playlist === "background") setBackgroundTracks(updater);
        else setTracks(updater);
      });
    });

    Promise.all(
      nextTracks.map((track) =>
        putSavedTrack({
          id: track.id,
          name: track.name,
          fileName: track.fileName,
          file: track.file,
          playlist,
          category: playlist === "background" ? "background" : "track",
          duration: track.duration,
          folderName: track.folderName,
          relativePath: track.relativePath,
          sourcePath: track.sourcePath,
        })
      )
    ).catch(() => setStatus("Las pistas cargaron, pero no se pudieron guardar en el navegador"));

    setStatus(
      `${nextTracks.length} pista${nextTracks.length === 1 ? "" : "s"} cargada${nextTracks.length === 1 ? "" : "s"} en ${
        playlist === "program" ? "programación" : playlist === "background" ? "fondos" : "playlist general"
      }`
    );
  }

  function addTracks(event, playlist = "general") {
    const files = Array.from(event.target.files || []);
    const audioFiles = files.filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|aac|m4a|ogg|flac)$/i.test(file.name));
    appendTracksToPlaylist(audioFiles, playlist);
    event.target.value = "";
  }

  function base64ToFile(base64, fileName, mimeType = "application/octet-stream") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new File([bytes], fileName, { type: mimeType });
  }

  async function importDesktopAudio(playlist = "general", directory = false) {
    if (!desktopApi?.openAudioFiles) {
      setStatus("Esta función nativa solo está disponible en la app de escritorio");
      return;
    }
    try {
      const result = await desktopApi.openAudioFiles({ directory });
      if (!result || result.canceled || !result.files?.length) return;
      const audioFiles = result.files.map((item) => ({
        file: base64ToFile(item.data, item.fileName, item.mimeType),
        fileName: item.fileName,
        name: item.fileName.replace(/\.[^/.]+$/, ""),
        folderName: item.folderName || "",
        relativePath: item.relativePath || item.fileName,
        sourcePath: item.path || "",
      }));
      appendTracksToPlaylist(audioFiles, playlist);
    } catch {
      setStatus("No se pudieron cargar audios desde el sistema");
    }
  }

  function removeTrack(id, playlist = "general") {
    const setter = playlist === "program" ? setProgramTracks : playlist === "background" ? setBackgroundTracks : setTracks;
    const selectedId = playlist === "program" ? selectedProgramTrackId : selectedTrackId;
    const setSelected = playlist === "program" ? setSelectedProgramTrackId : setSelectedTrackId;

    setter((prev) => {
      const removed = prev.find((track) => track.id === id);
      if (removed?.url) URL.revokeObjectURL(removed.url);

      const next = prev.filter((track) => track.id !== id);
      if (selectedId === id) setSelected(next[0]?.id || "");
      return next;
    });
    deleteSavedTrack(id).catch(() => {});
    setStatus("Pista eliminada");
  }

  function setIntroFromFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextIntro = {
      id: `intro-${crypto.randomUUID()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      file,
      url: URL.createObjectURL(file),
      color: "#f97316",
    };
    if (introTrack?.url) URL.revokeObjectURL(introTrack.url);
    setIntroTrack(nextIntro);
    putSavedTrack({ ...nextIntro, category: "intro" }).catch(() => {});
    setStatus("Intro cargada");
    event.target.value = "";
  }

  function playIntro() {
    if (!introTrack) {
      setStatus("Cargá una intro en Ajustes");
      return;
    }
    playOverlay(introTrack.url, `Intro: ${introTrack.name}`, "intro", state.introVolume);
  }

  function setEffectFromFile(index, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const nextEffect = {
      id: `effect-${index}-${crypto.randomUUID()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      file,
      url: URL.createObjectURL(file),
      color: "#f97316",
      slot: index,
    };
    setEffects((prev) => prev.map((item, itemIndex) => (itemIndex === index ? nextEffect : item)));
    putSavedTrack({ ...nextEffect, category: "effect", slot: index }).catch(() => {});
    setStatus(`Efecto cargado en botón ${index + 1}`);
    event.target.value = "";
  }

  function updateEffectMeta(index, field, value) {
    setEffects((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index || !item) return item;
        const nextItem = { ...item, [field]: value };
        putSavedTrack({ ...nextItem, category: "effect", slot: index }).catch(() => {});
        return nextItem;
      })
    );
  }

  function playEffect(effect) {
    if (!effect) return;
    playOverlay(effect.url, `Efecto: ${effect.name}`, "effect", state.effectVolume);
  }

  function togglePisadorPlayback(pisador) {
    if (!pisador?.url) return;
    const label = `Pisador: ${pisador.name}`;
    const samePisador =
      overlayAudioRef.current &&
      overlayKindRef.current === "pisador" &&
      overlayLabelRef.current === label;

    if (samePisador && !overlayAudioRef.current.paused) {
      overlayAudioRef.current.pause();
      setStatus(`Pisador pausado: ${pisador.name}`);
      return;
    }

    if (samePisador && overlayAudioRef.current.paused) {
      overlayAudioRef.current.play().then(startMeter).catch(() => setStatus(`No se pudo reanudar: ${pisador.name}`));
      setIsOverlayPlaying(true);
      setStatus(`Pisador reanudado: ${pisador.name}`);
      return;
    }

    playOverlay(pisador.url, label, "pisador", pisador.gain || 1);
  }

  function addRepeaterTracks(event) {
    const files = Array.from(event.target.files || []);
    const audioFiles = files.filter(
      (file) => file.type.startsWith("audio/") || /\.(mp3|wav|aac|m4a|ogg)$/i.test(file.name)
    );

    if (!audioFiles.length) {
      setStatus("Seleccioná audios para repeticiones");
      return;
    }

    const nextRepeaters = audioFiles.map((file) => ({
      id: `repeater-${crypto.randomUUID()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      file,
      url: URL.createObjectURL(file),
      minutes: 15,
      remaining: 15 * 60,
      enabled: true,
      gain: Number(state.repeaterVolume) || 1.15,
    }));

    setRepeaters((prev) => [...prev, ...nextRepeaters]);
    Promise.all(
      nextRepeaters.map((item) =>
        putSavedTrack({
          id: item.id,
          name: item.name,
          fileName: item.fileName,
          file: item.file,
          category: "repeater",
          minutes: item.minutes,
          enabled: item.enabled,
          gain: item.gain,
        })
      )
    ).catch(() => setStatus("Las repeticiones cargaron, pero no se pudieron guardar"));
    setStatus(`${nextRepeaters.length} repetición cargada${nextRepeaters.length === 1 ? "" : "s"}`);
    event.target.value = "";
  }

  function updateRepeater(id, patch) {
    setRepeaters((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextItem = {
          ...item,
          ...patch,
        };
        if (patch.minutes) {
          const minutes = Math.max(1, Number(patch.minutes) || 1);
          nextItem.minutes = minutes;
          nextItem.remaining = Math.min(nextItem.remaining || minutes * 60, minutes * 60);
        }
        putSavedTrack({
          id: nextItem.id,
          name: nextItem.name,
          fileName: nextItem.fileName,
          file: nextItem.file,
          category: "repeater",
          minutes: nextItem.minutes,
          enabled: nextItem.enabled,
          gain: nextItem.gain,
        }).catch(() => {});
        return nextItem;
      })
    );
  }

  function toggleRepeater(id) {
    setRepeaters((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextItem = { ...item, enabled: !item.enabled, remaining: item.minutes * 60 };
        putSavedTrack({
          id: nextItem.id,
          name: nextItem.name,
          fileName: nextItem.fileName,
          file: nextItem.file,
          category: "repeater",
          minutes: nextItem.minutes,
          enabled: nextItem.enabled,
          gain: nextItem.gain,
        }).catch(() => {});
        return nextItem;
      })
    );
  }

  function removeRepeater(id) {
    setRepeaters((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return prev.filter((item) => item.id !== id);
    });
    deleteSavedTrack(id).catch(() => {});
    setStatus("Repetición eliminada");
  }

  function setAllRepeatersEnabled(enabled) {
    setRepeaters((prev) =>
      prev.map((item) => {
        const nextItem = { ...item, enabled, remaining: item.minutes * 60 };
        putSavedTrack({
          id: nextItem.id,
          name: nextItem.name,
          fileName: nextItem.fileName,
          file: nextItem.file,
          category: "repeater",
          minutes: nextItem.minutes,
          enabled: nextItem.enabled,
          gain: nextItem.gain,
        }).catch(() => {});
        return nextItem;
      })
    );
    setStatus(enabled ? "Repeticiones activadas" : "Repeticiones suspendidas");
  }

  function addPisadorTracks(event) {
    const files = Array.from(event.target.files || []);
    const audioFiles = files.filter(
      (file) => file.type.startsWith("audio/") || /\.(mp3|wav|aac|m4a|ogg)$/i.test(file.name)
    );

    if (!audioFiles.length) {
      setStatus("Seleccioná audios para pisadores");
      return;
    }

    const nextPisadores = audioFiles.map((file) => ({
      id: `pisador-${crypto.randomUUID()}`,
      name: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      file,
      url: URL.createObjectURL(file),
      everyTracks: 2,
      position: "both",
      enabled: true,
      gain: 1,
    }));

    setPisadores((prev) => [...prev, ...nextPisadores]);
    Promise.all(
      nextPisadores.map((item) =>
        putSavedTrack({
          id: item.id,
          name: item.name,
          fileName: item.fileName,
          file: item.file,
          category: "pisador",
          everyTracks: item.everyTracks,
          position: item.position,
          enabled: item.enabled,
          gain: item.gain,
        })
      )
    ).catch(() => setStatus("Los pisadores cargaron, pero no se pudieron guardar"));
    setStatus(`${nextPisadores.length} pisador${nextPisadores.length === 1 ? "" : "es"} cargado${nextPisadores.length === 1 ? "" : "s"}`);
    event.target.value = "";
  }

  function updatePisador(id, patch) {
    setPisadores((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextItem = { ...item, ...patch };
        putSavedTrack({
          id: nextItem.id,
          name: nextItem.name,
          fileName: nextItem.fileName,
          file: nextItem.file,
          category: "pisador",
          everyTracks: nextItem.everyTracks,
          position: nextItem.position,
          enabled: nextItem.enabled,
          gain: nextItem.gain,
        }).catch(() => {});
        return nextItem;
      })
    );
  }

  function removePisador(id) {
    setPisadores((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.url) URL.revokeObjectURL(removed.url);
      return prev.filter((item) => item.id !== id);
    });
    deleteSavedTrack(id).catch(() => {});
    setStatus("Pisador eliminado");
  }

  function addRadio() {
    if (!radioUrl.trim()) {
      setStatus("Pegá una URL de radio");
      return;
    }

    const nextRadio = {
      id: crypto.randomUUID(),
      name: radioName.trim() || "Radio online",
      url: radioUrl.trim(),
      startTime: radioStart,
      endTime: radioEnd,
      scheduleEnabled: false,
    };

    setState((prev) => ({ ...prev, radios: [...prev.radios, nextRadio] }));
    setRadioName("");
    setRadioUrl("");
    setStatus("Radio agregada");
  }

  function playRadio(radio) {
    schedulerRadioIdRef.current = "";
    playMain(radio.url, `Radio: ${radio.name}`, "radio");
  }

  function toggleRadioSchedule(id) {
    setState((prev) => ({
      ...prev,
      radios: prev.radios.map((radio) =>
        radio.id === id ? { ...radio, scheduleEnabled: !radio.scheduleEnabled } : radio
      ),
    }));
  }

  function removeItem(type, id) {
    const item = state[type].find((entry) => entry.id === id);
    if (item?.source === "file") URL.revokeObjectURL(item.url);

    setState((prev) => ({
      ...prev,
      [type]: prev[type].filter((entry) => entry.id !== id),
    }));
    setStatus("Elemento eliminado");
  }

  function bringPanelToFront(id) {
    if (panelPrefs[id]?.pinned) return;
    setPanelOrder((prev) => {
      const next = prev.filter((panelId) => panelId !== id);
      next.push(id);
      return next;
    });
  }

  function startPanelMove(id, event) {
    if (!workspaceRef.current) return;
    if (panelPrefs[id]?.pinned) return;
    event.preventDefault();
    const rect = workspaceRef.current.getBoundingClientRect();
    const panel = floatingPanels[id];
    if (!panel) return;
    panelActionRef.current = {
      id,
      mode: "move",
      rectLeft: rect.left,
      rectTop: rect.top,
      offsetX: event.clientX - rect.left - panel.x,
      offsetY: event.clientY - rect.top - panel.y,
    };
    bringPanelToFront(id);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  function startPanelResize(id, event, minWidth = 260, minHeight = 180) {
    if (!workspaceRef.current) return;
    if (panelPrefs[id]?.pinned) return;
    event.preventDefault();
    event.stopPropagation();
    const panel = floatingPanels[id];
    if (!panel) return;
    panelActionRef.current = {
      id,
      mode: "resize",
      startX: event.clientX,
      startY: event.clientY,
      startW: panel.w,
      startH: panel.h,
      minWidth,
      minHeight,
    };
    bringPanelToFront(id);
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
  }

  function renderFloatingPanel(id, title, content, options = {}) {
    if (panelPrefs[id]?.visible === false) return null;
    const panel = floatingPanels[id] || DEFAULT_FLOATING_PANELS[id];
    const zIndex = panelOrder.indexOf(id) + 10;
    return (
      <section
        key={id}
        className="absolute overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        style={{
          left: panel.x,
          top: panel.y,
          width: panel.w,
          height: panel.h,
          zIndex,
        }}
        onMouseDown={() => bringPanelToFront(id)}
      >
        <div
          onMouseDown={(event) => startPanelMove(id, event)}
          className={`flex h-8 items-center justify-between border-b border-slate-200 bg-slate-100 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-600 ${panelPrefs[id]?.pinned ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
        >
          <span className="truncate">{title}</span>
          <div className="flex items-center gap-1 text-slate-400">
            <button type="button" onClick={() => setPanelPrefs((prev) => ({ ...prev, [id]: { ...prev[id], pinned: !prev[id]?.pinned } }))} className="rounded p-1 hover:bg-slate-200 hover:text-slate-700" aria-label={panelPrefs[id]?.pinned ? `Desfijar ${title}` : `Fijar ${title}`}>
              {panelPrefs[id]?.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => setPanelPrefs((prev) => ({ ...prev, [id]: { ...prev[id], visible: false } }))} className="rounded p-1 hover:bg-slate-200 hover:text-red-600" aria-label={`Cerrar ${title}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className={`h-[calc(100%-32px)] ${options.bodyClassName || "p-2"}`}>
          {content}
        </div>
        <button
          type="button"
          onMouseDown={(event) => startPanelResize(id, event, options.minWidth, options.minHeight)}
          className={`absolute bottom-1 right-1 h-4 w-4 rounded-sm bg-slate-300/90 ${panelPrefs[id]?.pinned ? "cursor-not-allowed opacity-40" : "cursor-nwse-resize"}`}
          aria-label={`Redimensionar ${title}`}
        />
      </section>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-950 p-2 text-slate-900">
      <div onClick={() => setTrackMenu(null)} className="grid h-[calc(100vh-16px)] w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden">
        <header className="rounded-lg border border-slate-800 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] p-2 text-white shadow-2xl shadow-slate-950/40">
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
              <img src={stationLogoSrc} alt="Logo de la radio" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/15" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300">Consola de aire</p>
                <h1 className="truncate text-xl font-black text-white">{state.stationName || "Radio Cast"}</h1>
                <p className="mt-0.5 truncate text-[11px] text-slate-300">{state.stationSlogan || "Playlist general, programación, radios y efectos al aire."}</p>
                {state.stationDetails ? <p className="mt-1 truncate text-[11px] text-slate-400">{state.stationDetails}</p> : <div className="mt-1 h-[16px]" />}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[auto_auto_190px_300px] sm:items-stretch">
              {!isDesktopApp && !isInstalled ? (
                <button onClick={installApp} className={`${buttonStyle} min-h-[52px] rounded-lg border border-white/10 ${installPrompt ? "bg-orange-500 text-white" : "bg-white/10 text-white"}`}>
                  <Save className="h-4 w-4" /> Instalar
                </button>
              ) : null}
              <button onClick={() => setSettingsOpen((open) => !open)} className={`${buttonStyle} min-h-[52px] rounded-lg border border-white/10 bg-white/10 text-white`}>
                <Settings className="h-4 w-4" /> Ajustes
              </button>
              <div className="grid min-h-[52px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Hora y clima</div>
                <div className="mt-0.5 text-sm font-black tabular-nums">{clockNow.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                <div className="truncate text-[11px] text-slate-300">
                  {state.stationCity ? `${state.stationCity} · ${weatherInfo.loading ? "consultando..." : [weatherInfo.text, weatherInfo.temperature].filter(Boolean).join(" · ")}` : "Cargá tu ciudad en Ajustes"}
                </div>
              </div>
              <div className={`w-[300px] shrink-0 rounded-lg border px-3 py-2 ${getStatusTone(status)}`}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Estado</div>
                <div className="mt-0.5 truncate text-xs font-semibold">{status}</div>
              </div>
            </div>
          </div>
        </header>

        {settingsOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4">
            <section className="h-[92vh] w-full max-w-6xl overflow-hidden rounded-lg border border-orange-200 bg-white p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-orange-700" />
                  <h2 className="text-lg font-black">Ajustes</h2>
                </div>
                <button onClick={() => setSettingsOpen(false)} className={`${buttonStyle} bg-slate-950 text-white`}>Cerrar</button>
              </div>

              <div className="mt-4 grid h-[calc(100%-72px)] gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="grid gap-1">
                    {[
                      ["station", "Radio y clima"],
                      ["panels", "Paneles"],
                      ["devices", "Dispositivos"],
                      ...(isDesktopApp ? [["desktop", "Desktop"]] : []),
                      ["levels", "Niveles"],
                      ["fx", "Intro y efectos"],
                    ].map(([id, label]) => (
                      <button key={id} onClick={() => setSettingsSection(id)} className={`rounded-lg px-3 py-2 text-left text-sm font-semibold ${settingsSection === id ? "bg-orange-500 text-white" : "text-slate-700 hover:bg-white"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="min-h-0 overflow-y-auto pr-1">
                {settingsSection === "station" ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <img src={stationDraft.stationLogo || stationLogoSrc} alt="Logo de la emisora" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                    <div>
                      <h3 className="text-sm font-black">Datos de tu radio</h3>
                      <p className="text-xs text-slate-500">Logo, nombre y datos se guardan en este navegador.</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <input value={stationDraft.stationName || ""} onChange={(event) => setStationDraft((prev) => ({ ...prev, stationName: event.target.value }))} className={inputStyle} placeholder="Nombre de tu radio" />
                    <input value={stationDraft.stationSlogan || ""} onChange={(event) => setStationDraft((prev) => ({ ...prev, stationSlogan: event.target.value }))} className={inputStyle} placeholder="Slogan o programa al aire" />
                    <input value={stationDraft.stationDetails || ""} onChange={(event) => setStationDraft((prev) => ({ ...prev, stationDetails: event.target.value }))} className={inputStyle} placeholder="Dial u otros datos" />
                    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2">
                      <div className="text-[11px] font-bold uppercase text-slate-500">Ciudad y clima</div>
                      <div className="flex gap-2">
                        <input value={stationDraft.stationCity || ""} onChange={(event) => setStationDraft((prev) => ({ ...prev, stationCity: event.target.value }))} className={`${inputStyle} flex-1`} placeholder="Buscá tu ciudad" />
                        <button onClick={searchCityClimate} disabled={citySearchLoading} className={`${buttonStyle} ${citySearchLoading ? "bg-slate-200 text-slate-500" : "bg-emerald-600 text-white"}`}>
                          <Search className="h-4 w-4" /> {citySearchLoading ? "Buscando" : "Buscar clima"}
                        </button>
                      </div>
                      {draftWeatherInfo.text ? (
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          Vista previa: {[draftWeatherInfo.text, draftWeatherInfo.temperature].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                      {cityMatches.length ? (
                        <div className="grid max-h-28 gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
                          {cityMatches.map((match) => (
                            <button key={match.id} onClick={() => chooseCityMatch(match)} className="rounded-md px-2 py-1 text-left text-xs text-slate-700 hover:bg-orange-50 hover:text-orange-700">
                              {match.name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <input ref={stationLogoInputRef} type="file" accept="image/*" onChange={uploadStationLogo} className="hidden" />
                    <button onClick={() => stationLogoInputRef.current?.click()} className={`${buttonStyle} bg-slate-800 text-white`}>
                      <Upload className="h-4 w-4" /> Cargar logo
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={applyStationDraft} className={`${buttonStyle} bg-orange-500 text-white`}>
                        <Save className="h-4 w-4" /> Guardar
                      </button>
                      <button onClick={() => { setStationDraft({ stationName: state.stationName || "", stationSlogan: state.stationSlogan || "", stationDetails: state.stationDetails || "", stationCity: state.stationCity || "", stationLogo: state.stationLogo || "" }); setStatus("Podés modificar los datos de la radio"); }} className={`${buttonStyle} bg-slate-950 text-white`}>
                        <Settings className="h-4 w-4" /> Modificar
                      </button>
                    </div>
                  </div>
                </div>
                ) : null}

                {settingsSection === "panels" ? (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-black">Paneles flotantes</h3>
                      <button onClick={resetPanelLayout} className={`${buttonStyle} bg-slate-950 text-white`}>Restablecer layout</button>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {Object.entries(PANEL_LABELS).map(([panelId, label]) => (
                        <div key={panelId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-xs font-bold text-slate-700">{label}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button onClick={() => setPanelPrefs((prev) => ({ ...prev, [panelId]: { ...prev[panelId], visible: !prev[panelId]?.visible } }))} className={`${buttonStyle} ${panelPrefs[panelId]?.visible ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                              {panelPrefs[panelId]?.visible ? "Mostrando" : "Oculto"}
                            </button>
                            <button onClick={() => setPanelPrefs((prev) => ({ ...prev, [panelId]: { ...prev[panelId], pinned: !prev[panelId]?.pinned } }))} className={`${buttonStyle} ${panelPrefs[panelId]?.pinned ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-700"}`}>
                              {panelPrefs[panelId]?.pinned ? "Fijo" : "Libre"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {settingsSection === "devices" ? (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-black">Dispositivos y operación</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">
                      Salida de audio
                      <select value={state.outputDeviceId || ""} onChange={(event) => updateSetting("outputDeviceId", event.target.value)} className={inputStyle}>
                        <option value="">Sistema</option>
                        {audioOutputs.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>{device.label || `Salida ${index + 1}`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">
                      Entrada de micrófono
                      <select value={state.inputDeviceId || ""} onChange={(event) => updateSetting("inputDeviceId", event.target.value)} className={inputStyle}>
                        <option value="">Predeterminado</option>
                        {audioInputs.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>{device.label || `Micrófono ${index + 1}`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={state.mixFoldersOnLoad} onChange={(event) => updateSetting("mixFoldersOnLoad", event.target.checked)} className="h-4 w-4 accent-orange-500" />
                      Mezclar carpetas al cargar
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={state.trimSilence} onChange={(event) => updateSetting("trimSilence", event.target.checked)} className="h-4 w-4 accent-orange-500" />
                      Cortar silencios al cambiar pista
                    </label>
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <button onClick={() => loadAudioDevices(true)} className={`${buttonStyle} bg-slate-950 text-white`}>
                        <Settings className="h-4 w-4" /> Detectar placas
                      </button>
                      <button onClick={enableMicrophone} className={`${buttonStyle} bg-slate-700 text-white`}>
                        <Mic2 className="h-4 w-4" /> Habilitar mic
                      </button>
                    </div>
                    </div>
                  </div>
                ) : null}

                {settingsSection === "desktop" ? (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-black">Modo escritorio</h3>
                    <p className="mt-1 text-xs text-slate-500">Opciones nativas para que Radio Cast se comporte más como software instalado.</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                        <input type="checkbox" checked={state.desktopCloseToTray} onChange={(event) => updateSetting("desktopCloseToTray", event.target.checked)} className="h-4 w-4 accent-orange-500" />
                        Minimizar a bandeja al cerrar
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                        <input type="checkbox" checked={state.desktopAutoLaunch} onChange={(event) => updateSetting("desktopAutoLaunch", event.target.checked)} className="h-4 w-4 accent-orange-500" />
                        Iniciar con el sistema
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 md:col-span-2">
                        <input type="checkbox" checked={state.desktopMediaShortcuts} onChange={(event) => updateSetting("desktopMediaShortcuts", event.target.checked)} className="h-4 w-4 accent-orange-500" />
                        Atajos globales: Play/Pausa, Siguiente, Stop, Locución e Intro
                      </label>
                    </div>
                    <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                      En escritorio, la carga de pistas y carpetas usa el explorador del sistema y la exportación M3U puede guardar con ruta real.
                    </div>
                  </div>
                ) : null}

                {settingsSection === "levels" ? (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-black">Niveles</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">
                      Volumen música <span className="text-[10px] text-slate-500">{formatPercent(state.mainVolume)}</span>
                      <input type="range" min="0" max="1" step="0.01" value={state.mainVolume} onChange={(event) => updateSetting("mainVolume", event.target.value)} className="accent-orange-500" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">
                      Volumen programación <span className="text-[10px] text-slate-500">{formatPercent(state.programVolume)}</span>
                      <input type="range" min="0" max="1" step="0.01" value={state.programVolume} onChange={(event) => updateSetting("programVolume", event.target.value)} className="accent-orange-500" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">
                      Volumen radios <span className="text-[10px] text-slate-500">{formatPercent(state.radioVolume)}</span>
                      <input type="range" min="0" max="1" step="0.01" value={state.radioVolume} onChange={(event) => updateSetting("radioVolume", event.target.value)} className="accent-orange-500" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">
                      Volumen intro <span className="text-[10px] text-slate-500">{formatPercent(state.introVolume, 2)}</span>
                      <input type="range" min="0" max="2" step="0.01" value={state.introVolume} onChange={(event) => updateSetting("introVolume", event.target.value)} className="accent-orange-500" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">
                      Volumen efectos <span className="text-[10px] text-slate-500">{formatPercent(state.effectVolume, 2)}</span>
                      <input type="range" min="0" max="2" step="0.01" value={state.effectVolume} onChange={(event) => updateSetting("effectVolume", event.target.value)} className="accent-orange-500" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-700">
                      Volumen repeticiones <span className="text-[10px] text-slate-500">{formatPercent(state.repeaterVolume, 3)}</span>
                      <input type="range" min="0" max="3" step="0.01" value={state.repeaterVolume} onChange={(event) => updateSetting("repeaterVolume", event.target.value)} className="accent-orange-500" />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
                      Fondo en locución <span className="text-[10px] text-slate-500">{formatPercent(state.duckingVolume)}</span>
                      <input type="range" min="0" max="1" step="0.01" value={state.duckingVolume} onChange={(event) => updateSetting("duckingVolume", event.target.value)} className="accent-orange-500" />
                    </label>
                    </div>
                  </div>
                ) : null}

                {settingsSection === "fx" ? (
              <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-sm font-black">Intro del programa</h3>
                  <p className="mt-1 text-xs text-slate-500">Podés lanzar esta intro desde la consola principal.</p>
                  <div className="mt-3 grid gap-2">
                    <input ref={introInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" onChange={setIntroFromFile} className="hidden" />
                    <button onClick={() => introInputRef.current?.click()} className={`${buttonStyle} bg-slate-950 text-white`}>
                      <Upload className="h-4 w-4" /> Cargar intro
                    </button>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      {introTrack ? introTrack.name : "Sin intro cargada"}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <h3 className="text-sm font-black">Botonera de efectos</h3>
                  <p className="mt-1 text-xs text-slate-500">Cada botón vacío permite cargar audio, nombre y color.</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {effects.map((effect, index) => (
                      <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                        <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" onChange={(event) => setEffectFromFile(index, event)} className="mb-2 block w-full text-[11px]" />
                        {effect ? (
                          <div className="grid gap-2">
                            <input value={effect.name} onChange={(event) => updateEffectMeta(index, "name", event.target.value)} className={inputStyle} placeholder={`Efecto ${index + 1}`} />
                            <input type="color" value={effect.color || "#f97316"} onChange={(event) => updateEffectMeta(index, "color", event.target.value)} className="h-9 w-full rounded border border-slate-300 bg-white p-1" />
                          </div>
                        ) : (
                          <div className="grid place-items-center rounded-lg border border-dashed border-slate-300 p-4 text-xs font-semibold text-slate-500">+ botón vacío</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
                ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                <button onClick={savePlaylistNow} className={`${buttonStyle} bg-orange-500 text-white`}>
                  <Save className="h-4 w-4" /> Guardar playlist
                </button>
                <button onClick={() => { applyStationDraft(); setStatus("Ajustes guardados"); setSettingsOpen(false); }} className={`${buttonStyle} bg-slate-950 text-white`}>
                  <Save className="h-4 w-4" /> Guardar ajustes
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <div className="min-h-0 overflow-auto rounded-lg border border-slate-800 bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_75%)]">
          <div ref={workspaceRef} className="relative min-h-full min-w-full" style={{ width: workspaceCanvas.width, height: workspaceCanvas.height }}>
          {renderFloatingPanel(
            "playlist",
            "Playlist MP3",
            <div className="flex h-full flex-col">
              <div className="flex flex-col gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-orange-100 p-1.5 text-orange-700"><Music className="h-4 w-4" /></span>
                  <div>
                    <h2 className="text-base font-bold">Playlist MP3</h2>
                    <p className="text-xs text-slate-500">{tracks.length} pista{tracks.length === 1 ? "" : "s"} general{tracks.length === 1 ? "" : "es"}.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input value={playlistSearch} onChange={(event) => setPlaylistSearch(event.target.value)} placeholder="Buscar pista" className={`${inputStyle} min-w-[120px] flex-1`} />
                  <button onClick={() => setPlaylistTab("all")} className={`${buttonStyle} ${playlistTab === "all" ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-800"}`}>Todas</button>
                  <button onClick={() => setPlaylistTab("background")} className={`${buttonStyle} ${playlistTab === "background" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-800"}`}>Fondos</button>
                  <button onClick={() => setPlaylistTab("featured")} className={`${buttonStyle} ${playlistTab === "featured" ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-800"}`}>Destacadas</button>
                  <button onClick={() => setState((prev) => ({ ...prev, playlistMode: prev.playlistMode === "random" ? "sequential" : "random" }))} className={`${buttonStyle} bg-slate-200 text-slate-800`}>
                    <Shuffle className="h-4 w-4" /> {state.playlistMode === "random" ? "Aleatorio" : "En orden"}
                  </button>
                  <input ref={trackInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" multiple onChange={(event) => addTracks(event, playlistTab === "background" ? "background" : "general")} className="hidden" />
                  <input ref={folderInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" multiple webkitdirectory="true" onChange={(event) => addTracks(event, playlistTab === "background" ? "background" : "general")} className="hidden" />
                  <button onClick={() => (isDesktopApp ? importDesktopAudio(playlistTab === "background" ? "background" : "general", false) : trackInputRef.current?.click())} className={`${buttonStyle} bg-slate-950 text-white`}><Upload className="h-4 w-4" /> {playlistTab === "background" ? "Cargar fondos" : "Cargar pistas"}</button>
                  <button onClick={() => (isDesktopApp ? importDesktopAudio(playlistTab === "background" ? "background" : "general", true) : folderInputRef.current?.click())} className={`${buttonStyle} bg-slate-700 text-white`}><Upload className="h-4 w-4" /> {playlistTab === "background" ? "Carpeta fondo" : "Cargar carpeta"}</button>
                  <input ref={backgroundInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" multiple onChange={(event) => addTracks(event, "background")} className="hidden" />
                  {playlistTab !== "background" ? <button onClick={() => (isDesktopApp ? importDesktopAudio("background", false) : backgroundInputRef.current?.click())} className={`${buttonStyle} bg-emerald-700 text-white`}><Upload className="h-4 w-4" /> Fondo</button> : null}
                  <button onClick={exportPlaylistM3U} className={`${buttonStyle} bg-emerald-700 text-white`}><Save className="h-4 w-4" /> M3U</button>
                  <button onClick={savePlaylistNow} className={`${buttonStyle} bg-orange-500 text-white`}><Save className="h-4 w-4" /> Guardar</button>
                </div>
              </div>
              <div className="mt-2 h-full min-h-0 overflow-y-auto rounded-lg border border-slate-200">
                {filteredTracks.length === 0 ? (
                  <p className="m-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">{playlistTab === "background" ? "Cargá pistas de fondo para locución." : "Todavía no cargaste pistas."}</p>
                ) : (
                  <div className="divide-y divide-slate-200">
                    <div className="sticky top-0 z-10 grid grid-cols-[34px_1fr_66px_28px] gap-1 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase text-slate-200">
                      <span>Nro</span><span>{playlistTab === "background" ? "Fondo" : "Pista"}</span><span>Control</span><span />
                    </div>
                    {filteredTracks.map((track, index) => (
                      <div key={track.id} onContextMenu={(event) => openTrackMenu(event, track, playlistTab === "background" ? "background" : "general")} draggable onDragStart={(event) => {
                        const payload = JSON.stringify({ id: track.id, listType: playlistTab === "background" ? "background" : "general" });
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData("text/radiocast-track", payload);
                        event.dataTransfer.setData("text/plain", payload);
                      }} onDoubleClick={() => playTrack(track)} className={`grid cursor-grab grid-cols-[34px_1fr_66px_28px] items-center gap-1 px-2 py-[2px] ${selectedTrackId === track.id ? (playlistTab === "background" ? "bg-emerald-50" : "bg-orange-50") : "bg-white"}`}>
                        <button onClick={() => playTrack(track)} className={`rounded px-1 py-0.5 text-[10px] font-semibold text-white ${playlistTab === "background" ? "bg-emerald-600" : "bg-orange-500"}`}>{String(index + 1).padStart(2, "0")}</button>
                        <button onClick={() => setSelectedTrackId(track.id)} className="min-w-0 text-left">
                          <div className="truncate text-[10px] font-semibold leading-4">{track.name}</div>
                          <div className="truncate text-[9px] leading-3 text-slate-500">{track.fileName}</div>
                        </button>
                        <button onClick={() => (isTrackPlaying(track.id) ? togglePlayPause() : playTrack(track))} className={`rounded px-1 py-0.5 text-center text-[9px] font-semibold ${isTrackPlaying(track.id) ? "bg-emerald-600 text-white" : playlistTab === "background" ? "bg-emerald-100 text-emerald-700" : state.featuredTrackIds.includes(track.id) ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{isTrackPlaying(track.id) ? "Pausa" : "Play"}</button>
                        <button onClick={() => removeTrack(track.id, playlistTab === "background" ? "background" : "general")} className="rounded bg-red-50 p-1 text-red-600"><Trash2 className="h-2.5 w-2.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>,
            { minWidth: 380, minHeight: 320, bodyClassName: "p-2 h-full" }
          )}

          {renderFloatingPanel(
            "program",
            "Programación",
            <div className="flex h-full flex-col">
              <div className="flex flex-col gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-red-100 p-1.5 text-red-700"><Music className="h-4 w-4" /></span>
                  <div>
                    <h2 className="text-base font-bold">Playlist de programación</h2>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{programTracks.filter((item) => item.kind !== "separator").length} pista{programTracks.filter((item) => item.kind !== "separator").length === 1 ? "" : "s"} · {hasProgramSeparators ? `${programBlocks.length} bloque${programBlocks.length === 1 ? "" : "s"}` : "sin bloques marcados"} · total {formatProgramMinutes(totalProgramSeconds)}</span>
                      {currentProgramBlock ? <span className="text-sm font-black text-red-600">{hasProgramSeparators ? currentProgramBlock.label : "Programación"}: {formatProgramMinutes(currentProgramBlock.remainingSeconds)}</span> : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{String(playingType).includes("program") ? "Sonando" : "En espera"}</div>
                  <input ref={programTrackInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" multiple onChange={(event) => addTracks(event, "program")} className="hidden" />
                  <input ref={programFolderInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" multiple webkitdirectory="true" onChange={(event) => addTracks(event, "program")} className="hidden" />
                  <button onClick={() => (isDesktopApp ? importDesktopAudio("program", false) : programTrackInputRef.current?.click())} className={`${buttonStyle} bg-slate-950 text-white`}><Upload className="h-4 w-4" /> Cargar pistas</button>
                  <button onClick={() => (isDesktopApp ? importDesktopAudio("program", true) : programFolderInputRef.current?.click())} className={`${buttonStyle} bg-slate-700 text-white`}><Upload className="h-4 w-4" /> Cargar carpeta</button>
                  <button onClick={() => insertProgramSeparator(selectedProgramTrackId || programTracks.filter((item) => item.kind !== "separator").slice(-1)[0]?.id)} disabled={!programTracks.some((item) => item.kind !== "separator")} className={`${buttonStyle} ${programTracks.some((item) => item.kind !== "separator") ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                    Marcar bloque
                  </button>
                </div>
              </div>
              <div className={`mt-2 h-full min-h-0 overflow-y-auto rounded-lg border ${programDropActive ? "border-red-500 bg-red-50/70" : "border-slate-200"}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setProgramDropActive(true); }} onDragLeave={() => setProgramDropActive(false)} onDrop={(event) => handleProgramDrop(event)}>
                {programTracks.length === 0 ? (
                  <p className="m-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Arrastrá pistas desde la playlist general o cargalas acá.</p>
                ) : !hasProgramSeparators ? (
                  <div className="grid gap-2 p-2">
                    <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-semibold text-orange-700">
                      Todavía no marcaste bloques. Armá la lista y usá `Marcar bloque` cuando quieras cerrar un bloque.
                    </div>
                    <div className="sticky top-0 z-10 grid grid-cols-[34px_1fr_92px_52px_28px] gap-1 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase text-slate-200"><span>Nro</span><span>Pista</span><span>Control</span><span>Orden</span><span /></div>
                    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                      {programTracks.filter((item) => item.kind !== "separator").map((track, index, list) => (
                        <div key={track.id}>
                          <div onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => handleProgramDrop(event, track.id, "before")} className="h-1.5 rounded bg-transparent hover:bg-orange-200/80" />
                        <div draggable onDragStart={(event) => {
                          const payload = JSON.stringify({ id: track.id, listType: "program" });
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/radiocast-track", payload);
                          event.dataTransfer.setData("text/plain", payload);
                        }} onContextMenu={(event) => openTrackMenu(event, track, "program")} onDoubleClick={() => playTrack(track, "program")} className={`grid cursor-grab grid-cols-[34px_1fr_92px_52px_28px] items-center gap-1 px-2 py-[2px] ${selectedProgramTrackId === track.id ? "bg-red-50" : "bg-white"}`}>
                          <button onClick={() => playTrack(track, "program")} className="rounded bg-red-600 px-1 py-0.5 text-[10px] font-semibold text-white">{String(index + 1).padStart(2, "0")}</button>
                          <button onClick={() => setSelectedProgramTrackId(track.id)} className="min-w-0 text-left">
                            <div className="truncate text-[10px] font-semibold leading-4">{track.name}</div>
                            <div className="truncate text-[9px] leading-3 text-slate-500">{track.fileName} {track.duration ? `· ${formatProgramMinutes(track.duration)}` : ""}</div>
                          </button>
                          <button onClick={() => (isTrackPlaying(track.id, "program") ? togglePlayPause() : playTrack(track, "program"))} className={`rounded px-1 py-0.5 text-center text-[9px] font-semibold ${isTrackPlaying(track.id, "program") ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{isTrackPlaying(track.id, "program") ? "Pausa" : "Play"}</button>
                          <div className="flex gap-1">
                            <button onClick={() => moveProgramItem(track.id, "up")} disabled={index === 0} className={`rounded p-1 ${index === 0 ? "bg-slate-100 text-slate-300" : "bg-slate-200 text-slate-700"}`}><ChevronUp className="h-3 w-3" /></button>
                            <button onClick={() => moveProgramItem(track.id, "down")} disabled={index === list.length - 1} className={`rounded p-1 ${index === list.length - 1 ? "bg-slate-100 text-slate-300" : "bg-slate-200 text-slate-700"}`}><ChevronDown className="h-3 w-3" /></button>
                          </div>
                          <button onClick={() => removeTrack(track.id, "program")} className="rounded bg-red-50 p-1 text-red-600"><Trash2 className="h-2.5 w-2.5" /></button>
                        </div>
                        {index === list.length - 1 ? <div onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => handleProgramDrop(event, track.id, "after")} className="h-1.5 rounded bg-transparent hover:bg-orange-200/80" /> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 p-2">
                    <div className="sticky top-0 z-10 grid grid-cols-[34px_1fr_92px_52px_28px] gap-1 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase text-slate-200"><span>Nro</span><span>Pista</span><span>Control</span><span>Orden</span><span /></div>
                    {(() => {
                      let trackCounter = 0;
                      return programBlocks.map((block) => {
                        const blockDuration = block.tracks.reduce((sum, item) => sum + Number(item.duration || 0), 0);
                        return (
                          <section key={block.id} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            <div className="grid gap-2 border-b border-slate-200 bg-slate-100 px-2 py-2 md:grid-cols-[minmax(0,1fr)_110px_92px_28px] md:items-center">
                              <input value={programBlockDrafts[block.separatorId || block.id] ?? block.label} onChange={(event) => setProgramBlockDrafts((prev) => ({ ...prev, [block.separatorId || block.id]: event.target.value }))} onBlur={() => commitProgramBlockName(block)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-700" />
                              <div className="text-[9px] font-semibold text-slate-500">{block.tracks.length} pista{block.tracks.length === 1 ? "" : "s"} · {formatProgramMinutes(blockDuration)}</div>
                              <select value={block.afterAction || "continue"} onChange={(event) => updateProgramBlock(block, { afterAction: event.target.value })} className="rounded border border-slate-300 bg-white px-2 py-1 text-[9px] font-semibold text-slate-700">
                                <option value="continue">Seguir</option>
                                <option value="background">Ir a fondo</option>
                                <option value="general">Ir a playlist</option>
                              </select>
                              {block.separatorId ? <button onClick={() => removeTrack(block.separatorId, "program")} className="rounded bg-red-50 p-1 text-red-600"><Trash2 className="h-2.5 w-2.5" /></button> : <div />}
                            </div>
                            <div className="divide-y divide-slate-200">
                              {block.tracks.map((track, innerIndex) => {
                                trackCounter += 1;
                                return (
                                  <div key={track.id}>
                                    <div onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => handleProgramDrop(event, track.id, "before")} className="h-1.5 rounded bg-transparent hover:bg-orange-200/80" />
                                  <div draggable onDragStart={(event) => {
                                    const payload = JSON.stringify({ id: track.id, listType: "program" });
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/radiocast-track", payload);
                                    event.dataTransfer.setData("text/plain", payload);
                                  }} onContextMenu={(event) => openTrackMenu(event, track, "program")} onDoubleClick={() => playTrack(track, "program")} className={`grid cursor-grab grid-cols-[34px_1fr_92px_52px_28px] items-center gap-1 px-2 py-[2px] ${selectedProgramTrackId === track.id ? "bg-red-50" : "bg-white"}`}>
                                    <button onClick={() => playTrack(track, "program")} className="rounded bg-red-600 px-1 py-0.5 text-[10px] font-semibold text-white">{String(trackCounter).padStart(2, "0")}</button>
                                    <button onClick={() => setSelectedProgramTrackId(track.id)} className="min-w-0 text-left">
                                      <div className="truncate text-[10px] font-semibold leading-4">{track.name}</div>
                                      <div className="truncate text-[9px] leading-3 text-slate-500">{track.fileName} {track.duration ? `· ${formatProgramMinutes(track.duration)}` : ""}</div>
                                    </button>
                                    <button onClick={() => (isTrackPlaying(track.id, "program") ? togglePlayPause() : playTrack(track, "program"))} className={`rounded px-1 py-0.5 text-center text-[9px] font-semibold ${isTrackPlaying(track.id, "program") ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{isTrackPlaying(track.id, "program") ? "Pausa" : "Play"}</button>
                                    <div className="flex gap-1">
                                      <button onClick={() => moveProgramItem(track.id, "up")} className="rounded bg-slate-200 p-1 text-slate-700"><ChevronUp className="h-3 w-3" /></button>
                                      <button onClick={() => moveProgramItem(track.id, "down")} className="rounded bg-slate-200 p-1 text-slate-700"><ChevronDown className="h-3 w-3" /></button>
                                    </div>
                                    <button onClick={() => removeTrack(track.id, "program")} className="rounded bg-red-50 p-1 text-red-600"><Trash2 className="h-2.5 w-2.5" /></button>
                                  </div>
                                  {innerIndex === block.tracks.length - 1 ? <div onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => handleProgramDrop(event, track.id, "after")} className="h-1.5 rounded bg-transparent hover:bg-orange-200/80" /> : null}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>,
            { minWidth: 400, minHeight: 320, bodyClassName: "p-2 h-full" }
          )}

          {renderFloatingPanel(
            "repeaters",
            "Repeticiones",
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2"><span className="rounded-lg bg-slate-100 p-1.5 text-slate-800"><Repeat2 className="h-4 w-4" /></span><h2 className="text-base font-bold">Repeticiones</h2></div>
                <div className="flex flex-wrap items-center gap-2">
                  <button disabled={!repeaters.length} onClick={() => setAllRepeatersEnabled(repeaters.some((item) => !item.enabled))} className={`${buttonStyle} ${!repeaters.length ? "bg-slate-200 text-slate-400" : repeaters.every((item) => item.enabled) ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>{!repeaters.length ? "Sin pistas" : repeaters.every((item) => item.enabled) ? "Suspender" : "Activar"}</button>
                  <div className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{isOverlayPlaying && overlayKindRef.current === "repeater" ? "Sonando" : "En espera"}</div>
                </div>
              </div>
              <div className="mt-2 grid gap-2">
                <input ref={repeaterInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" multiple onChange={addRepeaterTracks} className="hidden" />
                <button onClick={() => repeaterInputRef.current?.click()} className={`${buttonStyle} bg-slate-950 text-white`}><Plus className="h-4 w-4" /> Añadir pistas</button>
              </div>
              <div className="mt-2 grid min-h-0 flex-1 gap-1.5 overflow-y-auto pr-1">
                {repeaters.length === 0 ? <p className="text-sm text-slate-500">Sin repeticiones programadas.</p> : repeaters.map((repeater) => (
                  <div key={repeater.id} className="rounded-lg border border-slate-200 p-1.5">
                    <div className="truncate text-[11px] font-semibold">{repeater.name}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">Cada {repeater.minutes} min · Sale en {repeater.enabled ? formatTime(repeater.remaining) : "pausada"}</div>
                    <label className="mt-1.5 grid gap-1 text-[10px] font-semibold text-slate-600">Repetir cada (min)<input type="number" min="1" value={repeater.minutes} onChange={(event) => updateRepeater(repeater.id, { minutes: Number(event.target.value) || 1 })} className={`${inputStyle} py-1 text-[10px]`} /></label>
                    <label className="mt-1.5 grid gap-1 text-[10px] font-semibold text-slate-600">Ganancia<input type="range" min="0" max="3" step="0.01" value={repeater.gain ?? state.repeaterVolume} onChange={(event) => updateRepeater(repeater.id, { gain: Number(event.target.value) })} className="accent-orange-500" /></label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button onClick={() => toggleRepeater(repeater.id)} className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${repeater.enabled ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700"}`}>{repeater.enabled ? "Suspender" : "Activar"}</button>
                      <button onClick={() => { playOverlay(repeater.url, `Prueba repetición: ${repeater.name}`, "repeater", repeater.gain ?? state.repeaterVolume); }} className="rounded-lg bg-orange-500 px-2 py-1 text-[10px] font-semibold text-white">Probar</button>
                      <button onClick={() => removeRepeater(repeater.id)} className="rounded-lg bg-red-50 p-1.5 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>,
            { minWidth: 280, minHeight: 280, bodyClassName: "p-2 h-full" }
          )}

          {renderFloatingPanel(
            "radios",
            "Radios",
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2"><span className="rounded-lg bg-orange-100 p-1.5 text-orange-700"><Radio className="h-4 w-4" /></span><h2 className="text-base font-bold">Radios por URL y horario</h2></div>
                <div className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{String(playingType).includes("radio") ? "Sonando" : "En espera"}</div>
              </div>
              <div className="mt-2 grid gap-2 xl:grid-cols-[1fr_1.2fr_82px_82px_120px]">
                <input value={radioName} onChange={(event) => setRadioName(event.target.value)} placeholder="Nombre de la radio" className={inputStyle} />
                <input value={radioUrl} onChange={(event) => setRadioUrl(event.target.value)} placeholder="URL del streaming" className={inputStyle} />
                <input type="time" value={radioStart} onChange={(event) => setRadioStart(event.target.value)} className={inputStyle} />
                <input type="time" value={radioEnd} onChange={(event) => setRadioEnd(event.target.value)} className={inputStyle} />
                <button onClick={addRadio} className={`${buttonStyle} bg-slate-950 text-white`}><Save className="h-4 w-4" /> Agregar</button>
              </div>
              <div className="mt-2 grid h-full min-h-0 gap-1.5 overflow-y-auto pr-1">
                {state.radios.length === 0 ? <p className="text-sm text-slate-500">Todavía no cargaste radios.</p> : state.radios.map((radio) => (
                  <div key={radio.id} className="rounded-lg border border-slate-200 p-1.5">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold">{radio.name}</div>
                        <div className="break-all text-[10px] text-slate-500">{radio.url}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">{radio.startTime} a {radio.endTime}</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <button onClick={() => playRadio(radio)} className="rounded-lg bg-orange-500 px-2 py-1 text-[10px] font-semibold text-white">Play</button>
                        <button onClick={() => toggleRadioSchedule(radio.id)} className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${radio.scheduleEnabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>{radio.scheduleEnabled ? "Horario activo" : "Activar horario"}</button>
                        <button onClick={() => removeItem("radios", radio.id)} className="rounded-lg bg-red-50 p-1.5 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>,
            { minWidth: 360, minHeight: 220, bodyClassName: "p-2 h-full" }
          )}

          {renderFloatingPanel(
            "effects",
            "Intro y efectos",
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2"><span className="rounded-lg bg-orange-100 p-1.5 text-orange-700"><Mic2 className="h-4 w-4" /></span><h2 className="text-base font-bold">Intro y efectos</h2></div>
                <div className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{isOverlayPlaying && (overlayKindRef.current === "effect" || overlayKindRef.current === "intro") ? "Sonando" : "En espera"}</div>
              </div>
              <div className="mt-2 grid min-h-0 gap-2">
                <div className="rounded-lg border border-slate-200 p-2"><button onClick={playIntro} className="w-full rounded-lg bg-orange-500 px-3 py-3 text-sm font-black text-white shadow-sm">{introTrack ? `Lanzar intro: ${introTrack.name}` : "Cargá una intro en Ajustes"}</button></div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {effects.map((effect, index) => (
                    <button key={index} onClick={() => effect && playEffect(effect)} className="min-h-14 rounded-lg px-2 py-3 text-xs font-black text-white shadow-sm" style={{ backgroundColor: effect?.color || "#334155", opacity: effect ? 1 : 0.45 }}>
                      {effect?.name || `+ FX ${index + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            { minWidth: 360, minHeight: 220, bodyClassName: "p-2 h-full" }
          )}

          {renderFloatingPanel(
            "lead",
            "Aire",
            <div className="h-full min-w-0">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-500">Ahora suena</div>
                <div className="mt-1 break-words text-[28px] font-black leading-tight text-red-600 xl:text-[32px]">{state.nowPlayingLabel}</div>
                <div className="mt-1 text-xs text-slate-600">Modo: {playingType}</div>
                <div className="mt-3 grid max-w-[72%] gap-1.5">
                  <input type="range" min="0" max={seekEnabled ? duration : 0} step="1" value={seekEnabled ? Math.min(currentTime, duration) : 0} onChange={seekMainAudio} disabled={!seekEnabled} className="h-2 w-full accent-orange-500 disabled:opacity-40" />
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{seekEnabled ? formatTime(currentTime) : "En vivo"}</span>
                    <span>{seekEnabled ? formatTime(duration) : "Sin avance disponible"}</span>
                  </div>
                </div>
              </div>
              <div className="grid min-h-0 gap-2">
                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" /> Reloj de locución
                      </div>
                      <div className={`mt-1 text-[34px] font-black leading-none ${speechTimerTone}`}>{formatProgramMinutes(speechTimerRemaining)}</div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Objetivo: {speechTimerMinutes} min {speechTimerRunning ? "· contando" : speechTimerRemaining === 0 ? "· cumplido" : "· listo"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                      {speechTimerRunning ? "En aire" : "Stand by"}
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full transition-[width] duration-700 ${speechTimerRemaining <= 60 ? "bg-red-500" : speechTimerRemaining <= 180 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${speechTimerProgress}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[10, 20, 30].map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() => startSpeechTimer(minutes)}
                        className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black ${speechTimerMinutes === minutes ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700"}`}
                      >
                        {minutes} min
                      </button>
                    ))}
                    <label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500">
                      Manual
                      <input
                        type="number"
                        min="1"
                        max="240"
                        value={speechTimerMinutes}
                        onChange={(event) => setSpeechPreset(event.target.value)}
                        className="w-12 rounded border border-slate-200 px-1 py-0.5 text-[10px] text-slate-700 outline-none focus:border-orange-400"
                      />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <button onClick={() => startSpeechTimer()} className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white">
                      {speechTimerRunning ? "Reiniciar" : speechTimerRemaining < speechTimerMinutes * 60 && speechTimerRemaining > 0 ? "Volver a empezar" : "Iniciar"}
                    </button>
                    <button onClick={pauseSpeechTimer} className="rounded-lg bg-slate-200 px-3 py-2 text-[10px] font-black text-slate-700">Pausar</button>
                    <button onClick={resetSpeechTimer} className="rounded-lg bg-red-50 px-3 py-2 text-[10px] font-black text-red-600">Reset</button>
                  </div>
                </div>
              </div>
            </div>,
            { minWidth: 420, minHeight: 180, bodyClassName: "p-3 h-full" }
          )}

          {renderFloatingPanel(
            "pisadores",
            "Pisadores",
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-orange-100 p-1.5 text-orange-700"><Mic2 className="h-4 w-4" /></span>
                  <div>
                    <h2 className="text-base font-bold">Pisadores</h2>
                    <p className="text-[10px] text-slate-500">{pisadores.length} cargado{pisadores.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                    {isOverlayPlaying && overlayKindRef.current === "pisador" ? "Sonando" : "En espera"}
                  </div>
                  <input ref={pisadorInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" multiple onChange={addPisadorTracks} className="hidden" />
                  <button onClick={() => pisadorInputRef.current?.click()} className={`${buttonStyle} bg-slate-950 text-white`}><Plus className="h-4 w-4" /> Agregar</button>
                </div>
              </div>
              <div className="mt-2 grid min-h-0 gap-1.5 overflow-y-auto pr-1">
                {pisadores.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 px-3 py-3 text-[11px] text-slate-500">Cargá pisadores para dispararlos cada cierta cantidad de pistas o lanzarlos manualmente.</div> : pisadores.map((pisador) => {
                  const label = `Pisador: ${pisador.name}`;
                  const isCurrentPisador = overlayKindRef.current === "pisador" && overlayLabelRef.current === label && overlayAudioRef.current;
                  const isPisadorPlaying = Boolean(isCurrentPisador && !overlayAudioRef.current?.paused);
                  return (
                    <div key={pisador.id} className="grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[10px] font-bold text-slate-700">{pisador.name}</div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => togglePisadorPlayback(pisador)} className={`rounded px-2 py-1 text-[9px] font-bold ${isPisadorPlaying ? "bg-emerald-600 text-white" : "bg-orange-500 text-white"}`}>
                            {isPisadorPlaying ? "Pausar" : "Play"}
                          </button>
                          <button onClick={() => updatePisador(pisador.id, { enabled: !pisador.enabled })} className={`rounded px-2 py-1 text-[9px] font-bold ${pisador.enabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>{pisador.enabled ? "Activo" : "Off"}</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-[88px_110px_1fr_26px] items-end gap-1">
                        <label className="grid gap-1 text-[9px] font-bold uppercase text-slate-500">Cada<input type="number" min="1" value={pisador.everyTracks} onChange={(event) => updatePisador(pisador.id, { everyTracks: Math.max(1, Number(event.target.value) || 1) })} className={`${inputStyle} px-2 py-1 text-[10px]`} /></label>
                        <label className="grid gap-1 text-[9px] font-bold uppercase text-slate-500">Salida<select value={pisador.position} onChange={(event) => updatePisador(pisador.id, { position: event.target.value })} className={`${inputStyle} px-2 py-1 text-[10px]`}><option value="start">Inicio</option><option value="end">Final</option><option value="both">Inicio y final</option></select></label>
                        <label className="grid gap-1 text-[9px] font-bold uppercase text-slate-500">Ganancia {formatPercent(pisador.gain ?? 1, 2)}<input type="range" min="0" max="2" step="0.01" value={pisador.gain ?? 1} onChange={(event) => updatePisador(pisador.id, { gain: Number(event.target.value) })} className="accent-orange-500" /></label>
                        <button onClick={() => removePisador(pisador.id)} className="rounded bg-red-50 p-1 text-red-600"><Trash2 className="h-2.5 w-2.5" /></button>
                      </div>
                      <div className="text-[9px] text-slate-500">Cada {pisador.everyTracks} pista{pisador.everyTracks === 1 ? "" : "s"} · {pisador.position === "start" ? "sale al inicio" : pisador.position === "end" ? "sale al final" : "sale al inicio y al final"}</div>
                    </div>
                  );
                })}
              </div>
            </div>,
            { minWidth: 420, minHeight: 220, bodyClassName: "p-2 h-full" }
          )}
          </div>
        </div>

        <section className={`${panelStyle} border-slate-700 bg-slate-900 p-2 text-white`}>
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_168px]">
            <div className="grid gap-2 rounded-lg border border-white/10 bg-slate-950 p-2 xl:grid-cols-5">
              <button onClick={togglePlayPause} className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-orange-600">
                {isMainPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isMainPlaying ? "Pausar" : "Play"}
              </button>
              <button onClick={() => playNextTrack()} className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
                <SkipForward className="h-4 w-4" /> Siguiente
              </button>
              <button onClick={stopMainAudio} className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-red-700">
                <StopCircle className="h-4 w-4" /> Detener
              </button>
              <button onClick={playIntro} className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
                <Play className="h-4 w-4" /> Intro
              </button>
              <button onClick={toggleDucking} className={`min-h-[50px] w-full rounded-lg px-3 py-2 text-sm font-black shadow-lg transition ${isDucked ? "bg-red-600 text-white" : "bg-emerald-500 text-slate-950"}`}>
                {isDucked ? "LOCUCIÓN ACTIVA" : "LOCUCIÓN"}
              </button>
            </div>
            <div className="grid justify-items-center rounded-lg border border-white/10 bg-slate-950 p-2 overflow-hidden">
              <div className="mb-1 inline-flex items-center gap-1 text-xs font-bold text-slate-300"><Volume2 className="h-3.5 w-3.5" /> Master</div>
              <div className="flex items-end justify-center gap-3">
                {renderStereoVu(vuMeters.main)}
                {renderVerticalFader(state.mainVolume, (event) => setMainFaderVolume(event.target.value), 1)}
              </div>
            </div>
          </div>
        </section>
        <audio ref={micAudioRef} className="hidden" />
      </div>
      {trackMenu ? (
        <div
          className="fixed z-[60] w-52 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 py-1 text-xs font-semibold text-white shadow-2xl"
          style={{ left: trackMenu.x, top: trackMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {(() => {
            const track = [...tracks, ...backgroundTracks, ...programTracks].find((item) => item.id === trackMenu.trackId);
            if (!track) return null;
            return (
              <>
                {track.kind !== "separator" ? (
                  <button onClick={() => { playTrack(track, trackMenu.listType === "program" ? "program" : "general"); setTrackMenu(null); }} className="block w-full px-3 py-2 text-left hover:bg-orange-500">Reproducir</button>
                ) : null}
                {trackMenu.listType !== "program" && track.kind !== "separator" ? (
                  <button onClick={() => { sendTrackToProgram(track); setTrackMenu(null); }} className="block w-full px-3 py-2 text-left hover:bg-orange-500">Enviar a programación</button>
                ) : null}
                {trackMenu.listType === "program" && track.kind !== "separator" ? (
                  <button onClick={() => { insertProgramSeparator(track.id); setTrackMenu(null); }} className="block w-full px-3 py-2 text-left hover:bg-orange-500">Insertar separador debajo</button>
                ) : null}
                {track.kind !== "separator" ? (
                  <button onClick={() => { toggleFeaturedTrack(track.id); setTrackMenu(null); }} className="block w-full px-3 py-2 text-left hover:bg-orange-500">
                    {state.featuredTrackIds.includes(track.id) ? "Quitar destacada" : "Destacar pista"}
                  </button>
                ) : null}
                <button onClick={() => { removeTrack(track.id, trackMenu.listType === "program-separator" ? "program" : trackMenu.listType || "general"); setTrackMenu(null); }} className="block w-full px-3 py-2 text-left text-red-200 hover:bg-red-600">Eliminar</button>
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
