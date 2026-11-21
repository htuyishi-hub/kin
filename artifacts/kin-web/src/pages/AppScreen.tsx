import React, { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Flame,
  MessageCircle,
  Sparkles,
  User,
  Heart,
  X,
  Star,
  GraduationCap,
  ShieldCheck,
  Clock,
  LogOut,
  Send,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Candidate {
  id: string;
  name: string;
  age: number;
  location: string;
  occupation: string;
  isUrStudent: boolean;
  intent: string;
  trustScore: number;
  photoUrl: string;
  promptQuestion: string;
  promptAnswer: string;
}

const SAMPLE_PROFILES: Candidate[] = [
  {
    id: '1',
    name: 'Keza Diane',
    age: 23,
    location: 'Kigali, Nyarugenge',
    occupation: 'Software Engineer & UR Alum',
    isUrStudent: true,
    intent: 'Gushyingirwa · Marriage',
    trustScore: 85,
    photoUrl: '/images/couple1.jpg',
    promptQuestion: 'Ni ikihe gitekerezo cyagufasha kubana neza n\'abandi?',
    promptAnswer: 'Kubaha umwanya w\'undi, kumva mbere yo gusubiza, no gukorera mu kuri iteka.',
  },
  {
    id: '2',
    name: 'Manzi Eric',
    age: 25,
    location: 'Huye Campus',
    occupation: 'UR Medicine Student (Year 4)',
    isUrStudent: true,
    intent: 'Umubano w\'Igihe Kirekire · Long-term',
    trustScore: 92,
    photoUrl: '/images/couple2.jpg',
    promptQuestion: 'Wikend y\'amahoro uyimara gute?',
    promptAnswer: 'Gusura umuryango, gusoma ibitabo by\'amateka y\'u Rwanda, no gutembera ku kiyaga cya Kivu.',
  },
  {
    id: '3',
    name: 'Ineza Grace',
    age: 24,
    location: 'Kigali, Remera',
    occupation: 'Architect & Designer',
    isUrStudent: false,
    intent: 'Gushyingirwa · Marriage',
    trustScore: 78,
    photoUrl: '/images/couple3.jpg',
    promptQuestion: 'Sobanura inshuti y\'ubuzima mu magambo 3',
    promptAnswer: 'Ukwizera, Ubwitonzi, no Gushyigikirana mu bishya.',
  },
];

export default function AppScreen() {
  const [, setLocation] = useLocation();
  const { user, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<'discover' | 'matches' | 'serious' | 'profile'>('discover');
  const [profileIndex, setProfileIndex] = useState(0);
  const [goldenBids, setGoldenBids] = useState(3);
  const [matchAlert, setMatchAlert] = useState<string | null>(null);

  const currentProfile = SAMPLE_PROFILES[profileIndex % SAMPLE_PROFILES.length];

  function handleSwipe(action: 'pass' | 'like' | 'bid') {
    if (action === 'bid') {
      if (goldenBids <= 0) return;
      setGoldenBids((prev) => prev - 1);
      setMatchAlert(`Watanze Golden Bid kuri ${currentProfile.name}!`);
    } else if (action === 'like') {
      setMatchAlert(`Wakunze ${currentProfile.name}! (It's a Match)`);
    }

    setTimeout(() => {
      setMatchAlert(null);
      setProfileIndex((prev) => prev + 1);
    }, 1500);
  }

  async function handleSignOut() {
    await signOut();
    setLocation('/');
  }

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#0D1117] text-[#F0EDE6] select-none relative overflow-hidden">
      {/* App Top Bar */}
      <div className="px-5 py-3 border-b border-[#21262D] flex items-center justify-between bg-[#0D1117]/95 z-20">
        <div className="flex items-center gap-2">
          <span className="font-serif text-xl font-bold text-[#F0EDE6] tracking-tight">Kin</span>
          <span className="text-[10px] font-bold text-[#C9A84C] bg-[#C9A84C]/15 border border-[#C9A84C]/30 px-2 py-0.5 rounded-full">
            RWANDA
          </span>
        </div>

        {/* Golden Bids Pill */}
        <div className="flex items-center gap-1.5 bg-[#242438] border border-[#C9A84C]/40 px-2.5 py-1 rounded-full text-xs font-semibold text-[#C9A84C]">
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>{goldenBids} Golden Bids</span>
        </div>
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">
        {/* TAB 1: DISCOVER SWIPE DECK */}
        {activeTab === 'discover' && (
          <div className="flex-1 flex flex-col px-4 py-3 justify-between relative">
            {/* Match Toast Notification */}
            {matchAlert && (
              <div className="absolute top-4 left-4 right-4 z-30 p-3 bg-[#3FB950] text-[#0D1117] rounded-xl font-bold text-center text-xs shadow-xl animate-bounce">
                🎉 {matchAlert}
              </div>
            )}

            {/* Profile Card */}
            <div className="w-full flex-1 rounded-3xl bg-[#1A1A2E] border border-[#21262D] overflow-hidden flex flex-col relative shadow-2xl">
              {/* Photo Area */}
              <div className="relative h-64 w-full bg-[#242438] overflow-hidden">
                <img
                  src={currentProfile.photoUrl}
                  alt={currentProfile.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A2E] via-transparent to-black/30" />

                {/* Badge tags */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {currentProfile.isUrStudent && (
                    <span className="bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <GraduationCap className="w-3 h-3" />
                      UR STUDENT
                    </span>
                  )}
                  <span className="bg-[#0D1117]/80 backdrop-blur-sm text-[#3FB950] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#3FB950]/30">
                    <ShieldCheck className="w-3 h-3" />
                    Trust {currentProfile.trustScore}
                  </span>
                </div>

                {/* Bottom Photo Info */}
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-xl font-bold font-serif text-[#F0EDE6]">
                      {currentProfile.name}, {currentProfile.age}
                    </h2>
                    <p className="text-xs text-[#A8A49E] font-medium">{currentProfile.location}</p>
                  </div>
                </div>
              </div>

              {/* Card Details & Prompt Answer */}
              <div className="p-4 flex flex-col gap-3 flex-1 justify-between bg-[#1A1A2E]">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-[#C9A84C] font-semibold">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span>{currentProfile.intent}</span>
                  </div>
                  <p className="text-xs text-[#F0EDE6]/90 font-medium">
                    {currentProfile.occupation}
                  </p>
                </div>

                {/* Micro Prompt Quote Box */}
                <div className="p-3 bg-[#0D1117] rounded-xl border border-[#21262D]">
                  <p className="text-[11px] font-semibold text-[#A8A49E] mb-1">
                    "{currentProfile.promptQuestion}"
                  </p>
                  <p className="text-xs text-[#F0EDE6] font-medium leading-relaxed italic">
                    "{currentProfile.promptAnswer}"
                  </p>
                </div>
              </div>
            </div>

            {/* Swipe Action Buttons */}
            <div className="flex items-center justify-center gap-6 py-3">
              {/* Pass Button */}
              <button
                onClick={() => handleSwipe('pass')}
                className="w-13 h-13 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#A8A49E] flex items-center justify-center hover:text-[#FF6B6B] hover:border-[#FF6B6B] active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Golden Bid Button */}
              <button
                onClick={() => handleSwipe('bid')}
                disabled={goldenBids <= 0}
                className="w-15 h-15 rounded-full bg-[#C9A84C] text-[#0D1117] flex items-center justify-center font-bold active:scale-95 transition-all shadow-[0_0_20px_rgba(201,168,76,0.35)] disabled:opacity-50 cursor-pointer"
                title="Send Golden Bid"
              >
                <Star className="w-7 h-7 fill-current" />
              </button>

              {/* Like Button */}
              <button
                onClick={() => handleSwipe('like')}
                className="w-13 h-13 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#A8A49E] flex items-center justify-center hover:text-[#3FB950] hover:border-[#3FB950] active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <Heart className="w-6 h-6 fill-current text-[#FF6B6B]" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MATCHES & 3-PHASE CHAT */}
        {activeTab === 'matches' && (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <h2 className="font-serif text-lg font-bold text-[#F0EDE6]">
              Ibiganiro Byatangiye · Guided Chat
            </h2>

            {/* Active Match Card */}
            <div className="p-3.5 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center gap-3.5 hover:border-[#2563EB]/50 transition-colors cursor-pointer">
              <img
                src="/images/couple1.jpg"
                alt="Match"
                className="w-12 h-12 rounded-full object-cover border border-[#2563EB]"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#F0EDE6]">Keza Diane</h3>
                  <span className="text-[10px] text-[#A8A49E]">10m ago</span>
                </div>
                <p className="text-xs text-[#A8A49E] truncate">Muraho neza! Nshimishijwe no...</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] font-bold bg-[#2563EB]/20 text-[#2563EB] px-2 py-0.5 rounded">
                    Phase 1: Icebreakers
                  </span>
                  <span className="text-[10px] text-[#FF6B6B] flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    71h 45m
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center gap-3.5 opacity-80 cursor-pointer">
              <img
                src="/images/couple2.jpg"
                alt="Match"
                className="w-12 h-12 rounded-full object-cover border border-[#C9A84C]"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#F0EDE6]">Manzi Eric</h3>
                  <span className="text-[10px] text-[#A8A49E]">2h ago</span>
                </div>
                <p className="text-xs text-[#A8A49E] truncate">Golden Bid Accepted! Mwatangiye...</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[9px] font-bold bg-[#C9A84C]/20 text-[#C9A84C] px-2 py-0.5 rounded">
                    Phase 2: Mutual Prompts
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SERIOUS INTENT QUEUE */}
        {activeTab === 'serious' && (
          <div className="flex-1 flex flex-col p-5 gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#C9A84C]" />
              <h2 className="font-serif text-lg font-bold text-[#F0EDE6]">
                Umurongo w'Abiyemeje · Serious Queue
              </h2>
            </div>
            <p className="text-xs text-[#A8A49E] leading-relaxed">
              Aha hagenewe gusa abantu bafite intego yo gushyingirwa. Abari muri uyu murongo bahuzwa hashingiwe ku gaciro n'icyizere cy'umuryango.
            </p>

            <div className="p-4 bg-[#1A1A2E] border border-[#C9A84C]/30 rounded-2xl flex flex-col gap-3 mt-2">
              <span className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">
                Connection Tokens
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold text-[#F0EDE6]">3</span>
                <span className="text-xs text-[#A8A49E]">amatike asigaye</span>
              </div>
              <p className="text-[11px] text-[#A8A49E]">
                Buri guhura kwizewe muri uyu murongo kuguha amahirwe y'umubano urambye.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE & SETTINGS */}
        {activeTab === 'profile' && (
          <div className="flex-1 flex flex-col p-5 gap-4 justify-between">
            <div className="flex flex-col gap-4">
              <h2 className="font-serif text-lg font-bold text-[#F0EDE6]">
                Konti Yange · My Profile
              </h2>

              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-full bg-[#2563EB]/20 border border-[#2563EB] flex items-center justify-center text-[#2563EB] text-xl font-bold font-serif">
                  {user?.email?.charAt(0).toUpperCase() || 'K'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#F0EDE6] truncate max-w-[200px]">
                    {user?.email || 'kin.user@gmail.com'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="bg-[#3FB950]/20 text-[#3FB950] text-[10px] font-bold px-2 py-0.5 rounded">
                      Trust 50
                    </span>
                    <span className="bg-[#2563EB]/20 text-[#2563EB] text-[10px] font-bold px-2 py-0.5 rounded">
                      UR Badge
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="w-full py-3.5 px-4 bg-[#E5534B]/15 border border-[#FF6B6B] rounded-full text-xs font-bold text-[#FF6B6B] flex items-center justify-center gap-2 hover:bg-[#E5534B]/25 transition-colors cursor-pointer mb-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sohoka muri Konti · Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="h-16 px-6 bg-[#0D1117] border-t border-[#21262D] flex items-center justify-around z-20">
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'discover' ? 'text-[#2563EB]' : 'text-[#A8A49E]'
          }`}
        >
          <Flame className="w-5 h-5" />
          <span>Discover</span>
        </button>

        <button
          onClick={() => setActiveTab('matches')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'matches' ? 'text-[#2563EB]' : 'text-[#A8A49E]'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('serious')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'serious' ? 'text-[#C9A84C]' : 'text-[#A8A49E]'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>Serious</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'text-[#2563EB]' : 'text-[#A8A49E]'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
}
