import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Settings, 
  RotateCcw, 
  Subtitles, 
  Tv, 
  Loader2,
  Maximize2
} from "lucide-react";

interface VideoPlayerProps {
  url: string;
  subtitles?: string[];
  title?: string;
}

export function VideoPlayer({ url, subtitles = [], title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsLoading] = useState(true);
  const [qualities, setQualities] = useState<any[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // HLS.js setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    setIsLoading(true);

    if (Hls.isSupported()) {
      hls = new Hls({
        maxMaxBufferLength: 30,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        // Get qualities
        const levels = hls?.levels || [];
        setQualities(levels.map((level, index) => ({
          id: index,
          height: level.height,
          bitrate: level.bitrate,
          name: `${level.height}p`,
        })));
        
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        // Track active quality level
        if (hls?.autoLevelEnabled) {
          // Keep -1 (Auto) active
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("Fatal network error encountered, trying to recover...");
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("Fatal media error encountered, trying to recover...");
              hls?.recoverMediaError();
              break;
            default:
              console.error("Unrecoverable error:", data);
              break;
          }
        }
      });

      // Attach hls instance to window for debugging or manual quality changes
      (window as any).hlsInstance = hls;

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native iOS Safari support
      video.src = url;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      if (video) {
        video.src = "";
      }
    };
  }, [url]);

  // Video Events
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleDurationChange = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleWaiting = () => {
    setIsLoading(true);
  };

  const handlePlaying = () => {
    setIsLoading(false);
  };

  // Custom Controls Action Handlers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true));
    }
    triggerUserActivity();
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      videoRef.current.muted = vol === 0;
    }
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (videoRef.current) {
      videoRef.current.muted = nextMute;
      videoRef.current.volume = nextMute ? 0 : volume || 0.5;
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Fullscreen request failed", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const changeQuality = (id: number) => {
    const hls = (window as any).hlsInstance as Hls;
    if (hls) {
      hls.currentLevel = id;
      setCurrentQuality(id);
    }
    setShowSettings(false);
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSettings(false);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const mStr = String(m).padStart(2, "0");
    const sStr = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mStr}:${sStr}` : `${m}:${sStr}`;
  };

  // Hide controls after inactivity
  const triggerUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    triggerUserActivity();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div 
      ref={containerRef}
      onMouseMove={triggerUserActivity}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group border border-zinc-800 select-none"
    >
      {/* Actual HTML5 Video element */}
      <video
        ref={videoRef}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      >
        {subtitles.map((sub, i) => (
          <track
            key={i}
            src={sub}
            kind="subtitles"
            srcLang="en"
            label="English"
            default={i === 0}
          />
        ))}
      </video>

      {/* Buffering Loading Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 pointer-events-none">
          <Loader2 className="w-12 h-12 text-rose-500 animate-spin" />
        </div>
      )}

      {/* Interactive Play/Pause Big Center Button Overlay (Hidden on hover controls) */}
      {!isPlaying && !isBuffering && (
        <div 
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors cursor-pointer z-10"
        >
          <div className="p-5 rounded-full bg-rose-600/90 text-white shadow-lg hover:scale-110 transition-transform duration-300">
            <Play className="w-10 h-10 fill-current ml-1" />
          </div>
        </div>
      )}

      {/* Top Banner Bar (Title / Stream Source Indicator) */}
      <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center transition-all duration-300 z-10 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex flex-col">
          {title && <h2 className="text-white font-medium text-base tracking-wide drop-shadow-md">{title}</h2>}
          <div className="flex items-center gap-1.5 text-rose-400 text-xs mt-0.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>High-Speed Proxy Link Active</span>
          </div>
        </div>
        <div className="text-xs text-zinc-400 font-mono bg-zinc-950/80 px-2 py-1 rounded border border-zinc-800">
          HLS Stream
        </div>
      </div>

      {/* Custom Controls Bar Container */}
      <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-all duration-300 z-10 flex flex-col gap-3 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        
        {/* Progress / Timeline slider */}
        <div className="flex items-center gap-2 group/slider w-full">
          <span className="text-xs text-zinc-300 font-mono">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeekChange}
            className="flex-1 accent-rose-500 bg-zinc-700/60 rounded-lg appearance-none cursor-pointer h-1.5 hover:h-2 transition-all"
          />
          <span className="text-xs text-zinc-300 font-mono">{formatTime(duration)}</span>
        </div>

        {/* Player Controls Grid */}
        <div className="flex items-center justify-between">
          
          {/* Left Actions: Play/Pause/Mute */}
          <div className="flex items-center gap-4">
            <button 
              onClick={togglePlay}
              className="text-zinc-200 hover:text-white transition-colors duration-200"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Mute and Volume Control */}
            <div className="flex items-center gap-1.5 group/volume">
              <button 
                onClick={toggleMute}
                className="text-zinc-200 hover:text-white transition-colors duration-200"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="accent-white bg-zinc-700/50 rounded-lg appearance-none cursor-pointer h-1 w-0 group-hover/volume:w-16 transition-all duration-300 origin-left"
              />
            </div>
          </div>

          {/* Right Actions: Settings, Subtitles, Screen modes */}
          <div className="flex items-center gap-4 relative">
            
            {/* Speed / Quality Settings Button */}
            <button 
              onClick={() => {
                setShowSettings(!showSettings);
                setShowSubtitles(false);
              }}
              className={`text-zinc-200 hover:text-white transition-colors duration-200 ${showSettings ? "text-rose-500" : ""}`}
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Quality / Speed Menu Dropdown */}
            {showSettings && (
              <div className="absolute right-0 bottom-12 w-48 bg-zinc-950/95 border border-zinc-800 rounded-lg p-2 flex flex-col gap-2 shadow-2xl z-30">
                <div className="text-[10px] text-zinc-500 font-semibold px-2 uppercase tracking-wider">Video Quality</div>
                <div className="flex flex-col max-h-32 overflow-y-auto">
                  <button 
                    onClick={() => changeQuality(-1)}
                    className={`text-left text-xs px-2 py-1.5 rounded hover:bg-zinc-800 transition-colors flex items-center justify-between ${currentQuality === -1 ? "text-rose-400 font-medium" : "text-zinc-300"}`}
                  >
                    <span>Auto</span>
                  </button>
                  {qualities.map((q) => (
                    <button 
                      key={q.id}
                      onClick={() => changeQuality(q.id)}
                      className={`text-left text-xs px-2 py-1.5 rounded hover:bg-zinc-800 transition-colors flex items-center justify-between ${currentQuality === q.id ? "text-rose-400 font-medium" : "text-zinc-300"}`}
                    >
                      <span>{q.name}</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-zinc-800 my-1" />

                <div className="text-[10px] text-zinc-500 font-semibold px-2 uppercase tracking-wider">Playback Speed</div>
                <div className="flex flex-wrap gap-1 px-1">
                  {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                    <button 
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`text-xs px-1.5 py-1 rounded hover:bg-zinc-800 transition-colors flex-1 text-center ${playbackSpeed === s ? "bg-rose-600 text-white" : "text-zinc-400 bg-zinc-900/60"}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fullscreen Mode toggle */}
            <button 
              onClick={toggleFullscreen}
              className="text-zinc-200 hover:text-white transition-colors duration-200"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
