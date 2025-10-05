import { useEffect, useRef, useState } from "preact/hooks";
import { Signal, signal } from "@preact/signals";

declare global {
  interface Window {
    A: any;
    aladin: any;
  }
}

interface Marker {
  id: string;
  ra: number;
  dec: number;
  author: string;
  authorId: string;
  text: string;
  color: string;
  details?: string;
  timestamp: number;
}

interface Collection {
  id: string;
  name: string;
  markers: string[];
  authorId: string;
}

const colors = [
  { name: "Червоний", value: "#FF4444" },
  { name: "Синій", value: "#4444FF" },
  { name: "Зелений", value: "#44FF44" },
  { name: "Жовтий", value: "#FFFF44" },
  { name: "Фіолетовий", value: "#FF44FF" },
  { name: "Блакитний", value: "#44FFFF" },
  { name: "Помаранчевий", value: "#FFA500" },
];

export default function SpaceExplorer() {
  const aladinRef = useRef<HTMLDivElement>(null);
  const [aladin, setAladin] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>(colors[0].value);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showMarkerForm, setShowMarkerForm] = useState(false);
  const [currentCoords, setCurrentCoords] = useState({ ra: 0, dec: 0 });
  const [markerText, setMarkerText] = useState("");
  const [markerDetails, setMarkerDetails] = useState("");
  const [allPlayersMarkers, setAllPlayersMarkers] = useState<Marker[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Ініціалізація
  useEffect(() => {
    // Генерація або отримання userId
    let storedUserId = localStorage.getItem("userId");
    if (!storedUserId) {
      storedUserId = crypto.randomUUID();
      localStorage.setItem("userId", storedUserId);
    }
    setUserId(storedUserId);

    // Отримання імені
    let storedUserName = localStorage.getItem("userName");
    if (!storedUserName) {
      storedUserName = prompt("Введіть ваше ім'я:") || "Анонім";
      localStorage.setItem("userName", storedUserName);
    }
    setUserName(storedUserName);

    // Завантаження збережених маркерів
    const savedMarkers = localStorage.getItem("markers");
    if (savedMarkers) {
      setMarkers(JSON.parse(savedMarkers));
    }

    // Завантаження збережених колекцій
    const savedCollections = localStorage.getItem("collections");
    if (savedCollections) {
      setCollections(JSON.parse(savedCollections));
    }
  }, []);

  // Ініціалізація Aladin
  useEffect(() => {
    const initAladin = () => {
      if (aladinRef.current && window.A) {
        window.A.init.then(() => {
          const aladinInstance = window.A.aladin(aladinRef.current, {
            survey: "P/DSS2/color",
            fov: 60,
            target: "M31",
            showReticle: true,
            showCooGrid: false,
            showFrame: false,
            fullScreen: false,
            showFullscreenControl: true,
            showLayersControl: true,
            showGotoControl: true,
            showShareControl: false,
            showCatalog: true,
            showZoomControl: true,
            showSettingsControl: true,
          });

          window.aladin = aladinInstance;
          setAladin(aladinInstance);

          // Обробник кліків
          aladinInstance.on("click", (object: any) => {
            if (!object) {
              // Клік по небу
              const coords = aladinInstance.getRaDec();
              setCurrentCoords({ ra: coords[0], dec: coords[1] });
              setShowMarkerForm(true);
            } else if (object.data && object.data.markerId) {
              // Клік по маркеру
              handleMarkerClick(object.data.markerId);
            }
          });
        });
      } else {
        // Якщо Aladin ще не завантажено, спробувати через 100ms
        setTimeout(initAladin, 100);
      }
    };

    initAladin();
  }, []);

  // WebSocket підключення
  useEffect(() => {
    if (userId) {
      connectWebSocket();
    }
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [userId]);

  const connectWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws?userId=${userId}`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log("WebSocket підключено");
      // Запитати всі маркери
      websocket.send(JSON.stringify({ type: "getAllMarkers" }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "newMarker" && data.marker.authorId !== userId) {
        // Додати новий маркер від іншого гравця
        setAllPlayersMarkers(prev => [...prev, data.marker]);
        renderMarkerOnMap(data.marker);
      } else if (data.type === "allMarkers") {
        setAllPlayersMarkers(data.markers);
        data.markers.forEach((marker: Marker) => renderMarkerOnMap(marker));
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket помилка:", error);
    };

    websocket.onclose = () => {
      console.log("WebSocket закрито");
      // Перепідключення через 3 секунди
      setTimeout(connectWebSocket, 3000);
    };

    setWs(websocket);
  };

  const renderMarkerOnMap = (marker: Marker) => {
    if (!aladin) return;

    const cat = window.A.catalog({
      name: `Маркер від ${marker.author}`,
      sourceSize: 18,
      color: marker.color,
    });

    aladin.addCatalog(cat);

    cat.addSources([
      window.A.marker(marker.ra, marker.dec, {
        popupTitle: `${marker.author}: ${marker.text}`,
        popupDesc: marker.details || "",
        data: { markerId: marker.id },
      }),
    ]);
  };

  const handleMarkerClick = (markerId: string) => {
    const marker = allPlayersMarkers.find(m => m.id === markerId);
    if (marker && marker.authorId !== userId) {
      // Зберегти маркер іншого гравця
      const newMarkers = [...markers, marker];
      setMarkers(newMarkers);
      localStorage.setItem("markers", JSON.stringify(newMarkers));
      alert(`Ви зібрали маркер від ${marker.author}: ${marker.text}`);
    }
  };

  const addMarker = () => {
    if (!markerText.trim()) return;

    const newMarker: Marker = {
      id: crypto.randomUUID(),
      ra: currentCoords.ra,
      dec: currentCoords.dec,
      author: userName,
      authorId: userId,
      text: markerText,
      color: selectedColor,
      details: markerDetails,
      timestamp: Date.now(),
    };

    // Зберегти локально
    const newMarkers = [...markers, newMarker];
    setMarkers(newMarkers);
    localStorage.setItem("markers", JSON.stringify(newMarkers));

    // Відправити на сервер
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "addMarker", marker: newMarker }));
    }

    // Показати на карті
    renderMarkerOnMap(newMarker);

    // Очистити форму
    setMarkerText("");
    setMarkerDetails("");
    setShowMarkerForm(false);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      {/* Aladin container */}
      <div ref={aladinRef} className="absolute inset-0 z-0"></div>

      {/* UI overlay */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Верхня панель */}
        <div className="absolute top-0 left-0 right-0 p-4 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur rounded-lg p-4 text-white max-w-2xl mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">🌌 Space Markers</h1>
                <p className="text-sm opacity-80">
                  Гравець: {userName} | Маркерів зібрано: {markers.length}
                </p>
              </div>
              <div className="flex gap-2">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    className={`w-8 h-8 rounded-full border-2 ${
                      selectedColor === color.value
                        ? "border-white"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setSelectedColor(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Форма додавання маркера */}
        {showMarkerForm && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
            <div className="bg-black/90 backdrop-blur rounded-lg p-6 text-white max-w-md w-full mx-4">
              <h2 className="text-lg font-bold mb-4">Додати маркер</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">Назва маркера</label>
                  <input
                    type="text"
                    value={markerText}
                    onInput={(e) => setMarkerText((e.target as HTMLInputElement).value)}
                    className="w-full px-3 py-2 bg-white/10 rounded border border-white/20 focus:border-white/50 outline-none"
                    placeholder="Моя знахідка..."
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Деталі (опціонально)
                  </label>
                  <textarea
                    value={markerDetails}
                    onInput={(e) => setMarkerDetails((e.target as HTMLTextAreaElement).value)}
                    className="w-full px-3 py-2 bg-white/10 rounded border border-white/20 focus:border-white/50 outline-none"
                    rows={3}
                    placeholder="Опис знахідки..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addMarker}
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded font-medium"
                  >
                    Додати
                  </button>
                  <button
                    onClick={() => setShowMarkerForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium"
                  >
                    Скасувати
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Нижня панель з маркерами */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur rounded-lg p-4 text-white max-w-4xl mx-auto">
            <h3 className="text-sm font-bold mb-2">Ваші маркери:</h3>
            <div className="flex gap-2 overflow-x-auto">
              {markers.slice(-10).map((marker) => (
                <div
                  key={marker.id}
                  className="flex-shrink-0 px-3 py-1 rounded text-xs"
                  style={{ backgroundColor: marker.color + "33", borderColor: marker.color, borderWidth: 1 }}
                >
                  {marker.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}