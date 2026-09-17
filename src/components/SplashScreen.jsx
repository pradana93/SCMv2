import { useState, useEffect, useRef } from "react";

const SPLASH_VIDEO = "https://media.base44.com/videos/public/6a7aae7c455244dd401d4f58/e7cc770bf_splash_screen.mp4";
const STORAGE_KEY = "bangor_splash_shown";

export default function SplashScreen() {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const alreadyShown = sessionStorage.getItem(STORAGE_KEY);
    if (isMobile && !alreadyShown) {
      setShow(true);
      sessionStorage.setItem(STORAGE_KEY, "1");
      timerRef.current = setTimeout(() => {
        setFading(true);
        setTimeout(() => setShow(false), 500);
      }, 6000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
  }, []);

  const handleEnded = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFading(true);
    setTimeout(() => setShow(false), 500);
  };

  if (!show) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}>
      <video
        src={SPLASH_VIDEO}
        autoPlay
        muted
        playsInline
        onEnded={handleEnded}
        onError={handleEnded}
        onClick={handleEnded}
        className="h-full w-full object-cover"
      />
    </div>
  );
}