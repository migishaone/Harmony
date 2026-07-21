import { Button } from "@/components/ui/button";

interface Props {
  onStart: () => void;
}

export function WelcomeOverlay({ onStart }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background p-5 text-foreground">
      <div className="relative z-10 flex max-w-md flex-col items-center border border-border bg-card p-8 text-center">
        <img src="/harmony-logo.svg" alt="Harmony" className="mb-6 h-auto w-64 max-w-full" />
        
        <p className="text-sm text-muted-foreground font-mono mb-8 leading-relaxed">
          A touchless harmonic instrument. <br/>
          Hold up one finger, two fingers, or an open hand and point toward a chord to play it instantly.
        </p>

        <Button 
          onClick={onStart}
          className="w-full h-12 font-mono uppercase tracking-widest bg-primary/10 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 rounded-none"
        >
          Initialize System
        </Button>
        
        <p className="mt-4 text-[10px] text-muted-foreground font-mono uppercase opacity-50">
          Requires Webcam & Audio Permissions
        </p>
      </div>
    </div>
  );
}
