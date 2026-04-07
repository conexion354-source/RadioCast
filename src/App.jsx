import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, StopCircle, Radio, Mic2, Plus, Trash2, Clock3, Save } from "lucide-react";

const STORAGE_KEY = "radio_web_app_v1";
const DEFAULT_SPOT_INTERVAL_MINUTES = 5;

const BRAND_NAME = "Radio Cast";
const LOGO_SRC = `${import.meta.env.BASE_URL}radiocast-logo.jpg`;

const buttonStyle =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 active:translate-y-0";

const inputStyle =
  "min-w-0 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100";

const panelStyle = "rounded-lg border border-slate-200 bg-white p-5 shadow-sm";

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function getInitialState() {
  const fallback = {
    radioUrl: "",
    spotIntervalMinutes: DEFAULT_SPOT_INTERVAL_MINUTES,
    spotsEnabled: false,
    spots: [],
    pisadores: [],
    ads: [],
    nowPlayingLabel: "Nada reproduciéndose",
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

export default function App() {
  const [state, setState] = useState(getInitialState);
  const [radioInput, setRadioInput] = useState("");
  const [spotName, setSpotName] = useState("");
  const [spotUrl, setSpotUrl] = useState("");
  const [pisadorName, setPisadorName] = useState("");
  const [pisadorUrl, setPisadorUrl] = useState("");
  const [adName, setAdName] = useState("");
  const [adUrl, setAdUrl] = useState("");
  const [adMinutes, setAdMinutes] = useState(15);
  const [status, setStatus] = useState("Listo para empezar");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [secondsToNextSpot, setSecondsToNextSpot] = useState(
    state.spotIntervalMinutes * 60
  );
  const [spotIndex, setSpotIndex] = useState(0);
  const [playingType, setPlayingType] = useState("none");

  const audioRef = useRef(null);
  const radioVolumeBeforePisadorRef = useRef(1);
  const spotTimerRef = useRef(null);
  const adTimersRef = useRef([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setRadioInput(state.radioUrl || "");
  }, [state.radioUrl]);

  const nextSpotName = useMemo(() => {
    if (!state.spots.length) return "Sin spots cargados";
    return state.spots[spotIndex % state.spots.length]?.name || "Sin spots";
  }, [state.spots, spotIndex]);

  function saveRadioUrl() {
    setState((prev) => ({ ...prev, radioUrl: radioInput.trim() }));
    setStatus("URL de radio guardada");
  }

  function playRadio() {
    if (!state.radioUrl) {
      setStatus("Pegá una URL de radio primero");
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(state.radioUrl);
    audio.crossOrigin = "anonymous";
    audio.volume = 1;
    audio.play().catch(() => {
      setStatus("No se pudo reproducir la radio. Revisá la URL o el navegador.");
    });
    audioRef.current = audio;
    setPlayingType("radio");
    setState((prev) => ({ ...prev, nowPlayingLabel: `Radio URL: ${state.radioUrl}` }));
    setStatus("Reproduciendo radio desde URL");
  }

  function pauseCurrent() {
    if (audioRef.current) {
      audioRef.current.pause();
      setStatus("Pausado");
    }
  }

  function stopCurrent() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingType("none");
    setState((prev) => ({ ...prev, nowPlayingLabel: "Nada reproduciéndose" }));
    setStatus("Detenido");
  }

  function addSpot() {
    if (!spotName.trim() || !spotUrl.trim()) {
      setStatus("Completá nombre y URL del spot");
      return;
    }
    setState((prev) => ({
      ...prev,
      spots: [...prev.spots, { id: crypto.randomUUID(), name: spotName.trim(), url: spotUrl.trim() }],
    }));
    setSpotName("");
    setSpotUrl("");
    setStatus("Spot agregado");
  }

  function addPisador() {
    if (!pisadorName.trim() || !pisadorUrl.trim()) {
      setStatus("Completá nombre y URL del pisador");
      return;
    }
    setState((prev) => ({
      ...prev,
      pisadores: [...prev.pisadores, { id: crypto.randomUUID(), name: pisadorName.trim(), url: pisadorUrl.trim() }],
    }));
    setPisadorName("");
    setPisadorUrl("");
    setStatus("Pisador agregado");
  }

  function addAd() {
    if (!adName.trim() || !adUrl.trim() || Number(adMinutes) <= 0) {
      setStatus("Completá nombre, URL e intervalo de publicidad");
      return;
    }
    setState((prev) => ({
      ...prev,
      ads: [
        ...prev.ads,
        {
          id: crypto.randomUUID(),
          name: adName.trim(),
          url: adUrl.trim(),
          intervalMinutes: Number(adMinutes),
          active: true,
        },
      ],
    }));
    setAdName("");
    setAdUrl("");
    setAdMinutes(15);
    setStatus("Publicidad agregada");
  }

  function removeItem(type, id) {
    setState((prev) => ({
      ...prev,
      [type]: prev[type].filter((item) => item.id !== id),
    }));
    setStatus("Elemento eliminado");
  }

  function playOverlay(url, label, kind) {
    const overlay = new Audio(url);
    overlay.volume = 1;

    if (audioRef.current && playingType === "radio") {
      radioVolumeBeforePisadorRef.current = audioRef.current.volume;
      audioRef.current.volume = 0.25;
    }

    overlay.play().catch(() => {
      setStatus(`No se pudo reproducir: ${label}`);
    });

    setState((prev) => ({ ...prev, nowPlayingLabel: label }));
    setStatus(`${kind} lanzado`);

    overlay.onended = () => {
      if (audioRef.current && playingType === "radio") {
        audioRef.current.volume = radioVolumeBeforePisadorRef.current;
        setState((prev) => ({ ...prev, nowPlayingLabel: `Radio URL: ${state.radioUrl || "activa"}` }));
      } else {
        setState((prev) => ({ ...prev, nowPlayingLabel: "Nada reproduciéndose" }));
      }
    };
  }

  function triggerNextSpot() {
    if (!state.spots.length) {
      setStatus("No hay spots cargados");
      return;
    }
    const next = state.spots[spotIndex % state.spots.length];
    playOverlay(next.url, `Spot: ${next.name}`, "Spot");
    setSpotIndex((prev) => (prev + 1) % Math.max(1, state.spots.length));
    setSecondsToNextSpot(state.spotIntervalMinutes * 60);
  }

  function toggleSpots() {
    setState((prev) => ({ ...prev, spotsEnabled: !prev.spotsEnabled }));
  }

  useEffect(() => {
    if (spotTimerRef.current) clearInterval(spotTimerRef.current);

    if (!state.spotsEnabled) return;

    setSecondsToNextSpot(state.spotIntervalMinutes * 60);

    spotTimerRef.current = setInterval(() => {
      setSecondsToNextSpot((prev) => {
        if (prev <= 1) {
          triggerNextSpot();
          return state.spotIntervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (spotTimerRef.current) clearInterval(spotTimerRef.current);
    };
  }, [state.spotsEnabled, state.spotIntervalMinutes, state.spots, spotIndex]);

  useEffect(() => {
    adTimersRef.current.forEach(clearInterval);
    adTimersRef.current = [];

    state.ads
      .filter((ad) => ad.active)
      .forEach((ad) => {
        const timer = setInterval(() => {
          playOverlay(ad.url, `Publicidad: ${ad.name}`, "Publicidad");
        }, ad.intervalMinutes * 60 * 1000);
        adTimersRef.current.push(timer);
      });

    return () => {
      adTimersRef.current.forEach(clearInterval);
      adTimersRef.current = [];
    };
  }, [state.ads]);

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-900 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900 text-white shadow-2xl shadow-slate-950/40">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div className="flex min-w-0 items-center gap-4">
              <img
                src={LOGO_SRC}
                alt="Radio Cast"
                className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-white/15"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-orange-300">Automatizador de radio</p>
                <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">{BRAND_NAME}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Consola para operar radio online, spots, pisadores y tandas publicitarias desde un solo panel.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white">
              <div className="text-xs font-semibold uppercase text-slate-400">Hora actual</div>
              <div className="mt-1 text-2xl font-bold">
                {new Date(currentTime).toLocaleTimeString("es-AR")}
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className={panelStyle}>
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <span className="rounded-lg bg-orange-100 p-2 text-orange-700">
                <Radio className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold">Reproductor principal</h2>
            </div>

            <div className="mt-5 border-l-4 border-orange-500 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-500">Ahora suena</div>
              <div className="mt-1 break-words text-lg font-bold">{state.nowPlayingLabel}</div>
              <div className="mt-2 text-sm text-slate-600">Estado: {status}</div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                value={radioInput}
                onChange={(e) => setRadioInput(e.target.value)}
                placeholder="URL del streaming de la radio"
                className={inputStyle}
              />
              <button onClick={saveRadioUrl} className={`${buttonStyle} bg-slate-950 text-white`}>
                <Save className="h-4 w-4" /> Guardar URL
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={playRadio} className={`${buttonStyle} bg-orange-500 text-white hover:bg-orange-600`}>
                <Play className="h-4 w-4" /> Reproducir radio
              </button>
              <button onClick={pauseCurrent} className={`${buttonStyle} bg-slate-700 text-white hover:bg-slate-800`}>
                <Pause className="h-4 w-4" /> Pausar
              </button>
              <button onClick={stopCurrent} className={`${buttonStyle} bg-red-600 text-white hover:bg-red-700`}>
                <StopCircle className="h-4 w-4" /> Detener
              </button>
            </div>
          </section>

          <section className={panelStyle}>
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <span className="rounded-lg bg-slate-100 p-2 text-slate-800">
                <Clock3 className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold">Spots automáticos</h2>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px]">
              <input
                type="number"
                min="1"
                value={state.spotIntervalMinutes}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    spotIntervalMinutes: Number(e.target.value) || DEFAULT_SPOT_INTERVAL_MINUTES,
                  }))
                }
                className={inputStyle}
              />
              <button
                onClick={toggleSpots}
                className={`${buttonStyle} ${state.spotsEnabled ? "bg-red-600 text-white hover:bg-red-700" : "bg-slate-950 text-white"}`}
              >
                {state.spotsEnabled ? "Desactivar" : "Activar"}
              </button>
            </div>

            <div className="mt-4 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-500">Próximo spot</div>
              <div className="mt-1 font-bold">{nextSpotName}</div>
              <div className="mt-2 text-sm text-slate-600">
                Sale en: {state.spotsEnabled ? formatTime(secondsToNextSpot) : "Desactivado"}
              </div>
            </div>

            <button onClick={triggerNextSpot} className={`${buttonStyle} mt-4 bg-orange-500 text-white hover:bg-orange-600`}>
              <Play className="h-4 w-4" /> Lanzar spot ahora
            </button>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className={panelStyle}>
            <h3 className="text-lg font-bold">Cargar spots</h3>
            <div className="mt-4 grid gap-3">
              <input
                value={spotName}
                onChange={(e) => setSpotName(e.target.value)}
                placeholder="Nombre del spot"
                className={inputStyle}
              />
              <input
                value={spotUrl}
                onChange={(e) => setSpotUrl(e.target.value)}
                placeholder="URL del audio del spot"
                className={inputStyle}
              />
              <button onClick={addSpot} className={`${buttonStyle} bg-slate-950 text-white`}>
                <Plus className="h-4 w-4" /> Agregar spot
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {state.spots.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no cargaste spots.</p>
              ) : (
                state.spots.map((spot) => (
                  <div key={spot.id} className="flex items-center justify-between gap-3 border border-slate-200 p-3">
                    <div className="min-w-0">
                      <div className="font-medium">{spot.name}</div>
                      <div className="text-xs text-slate-500 break-all">{spot.url}</div>
                    </div>
                    <button onClick={() => removeItem("spots", spot.id)} className="shrink-0 rounded-lg bg-red-50 p-2 text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={panelStyle}>
            <h3 className="text-lg font-bold">Pisadores</h3>
            <div className="mt-4 grid gap-3">
              <input
                value={pisadorName}
                onChange={(e) => setPisadorName(e.target.value)}
                placeholder="Nombre del pisador"
                className={inputStyle}
              />
              <input
                value={pisadorUrl}
                onChange={(e) => setPisadorUrl(e.target.value)}
                placeholder="URL del audio del pisador"
                className={inputStyle}
              />
              <button onClick={addPisador} className={`${buttonStyle} bg-slate-950 text-white`}>
                <Plus className="h-4 w-4" /> Agregar pisador
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {state.pisadores.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no cargaste pisadores.</p>
              ) : (
                state.pisadores.map((item) => (
                  <div key={item.id} className="flex flex-col justify-between gap-3 border border-slate-200 p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 font-medium">{item.name}</div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        onClick={() => playOverlay(item.url, `Pisador: ${item.name}`, "Pisador")}
                        className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                      >
                        <Mic2 className="mr-1 inline h-4 w-4" /> Lanzar
                      </button>
                      <button onClick={() => removeItem("pisadores", item.id)} className="rounded-lg bg-red-50 p-2 text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={panelStyle}>
            <h3 className="text-lg font-bold">Publicidades programadas</h3>
            <div className="mt-4 grid gap-3">
              <input
                value={adName}
                onChange={(e) => setAdName(e.target.value)}
                placeholder="Nombre de la publicidad"
                className={inputStyle}
              />
              <input
                value={adUrl}
                onChange={(e) => setAdUrl(e.target.value)}
                placeholder="URL del audio publicitario"
                className={inputStyle}
              />
              <input
                type="number"
                min="1"
                value={adMinutes}
                onChange={(e) => setAdMinutes(Number(e.target.value) || 15)}
                placeholder="Cada cuántos minutos"
                className={inputStyle}
              />
              <button onClick={addAd} className={`${buttonStyle} bg-slate-950 text-white`}>
                <Plus className="h-4 w-4" /> Agregar publicidad
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {state.ads.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no cargaste publicidades.</p>
              ) : (
                state.ads.map((ad) => (
                  <div key={ad.id} className="border border-slate-200 p-3">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <div className="font-medium">{ad.name}</div>
                        <div className="text-xs text-slate-500">Cada {ad.intervalMinutes} minutos</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              ads: prev.ads.map((item) =>
                                item.id === ad.id ? { ...item, active: !item.active } : item
                              ),
                            }))
                          }
                          className={`rounded-lg px-3 py-2 text-sm font-semibold ${ad.active ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
                        >
                          {ad.active ? "Activa" : "Pausada"}
                        </button>
                        <button onClick={() => playOverlay(ad.url, `Publicidad: ${ad.name}`, "Publicidad")} className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600">
                          Probar
                        </button>
                        <button onClick={() => removeItem("ads", ad.id)} className="rounded-lg bg-red-50 p-2 text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
