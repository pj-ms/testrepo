import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { SERVER_URL } from "@/constants/server-url";
import { ErrorBoundary } from "@/error-boundary";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
// We don't currently use the strongly typed hono client wrapper in our components.
// If you want to add type-safe API calls you can uncomment the following imports:
// import { hc } from 'hono/client';
// import type { AppType } from '../../backend/src/index';

import { useState, useCallback, FormEvent, ChangeEvent } from 'react';

// const client = hc<AppType>(SERVER_URL, { init: { credentials: 'include' } });

const queryClient = new QueryClient();

interface User {
    id: number;
    email: string;
    username: string;
    description?: string;
    profilePhoto?: string;
}

function AppImpl() {
  const {
    data: me,
    isLoading: isLoadingMe,
    refetch: refetchMe,
  } = useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<User | null> => {
      const response = await fetch(`${SERVER_URL}/api/auth/me`, {
        credentials: 'include',
      });
      return await response.json();
    },
  });
  const [view, setView] = useState<'feed' | 'profile'>('feed');
  const [profileUser, setProfileUser] = useState<any>(null);

  const openProfile = useCallback(async (username: string) => {
    const response = await fetch(`${SERVER_URL}/api/users/${username}`);
    const data = await response.json();
    setProfileUser(data);
    setView('profile');
  }, []);

  const goToFeed = useCallback(() => {
    setView('feed');
    setProfileUser(null);
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${SERVER_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    refetchMe();
    goToFeed();
  }, [refetchMe, goToFeed]);

  if (isLoadingMe) return <div className="p-4">Loading...</div>;
  if (!me) {
    return (
      <LoginForm onLogin={() => refetchMe()} />
    );
  }
  return (
    <MainView
      user={me as User}
      view={view}
      profileUser={profileUser}
      openProfile={openProfile}
      goToFeed={goToFeed}
      logout={logout}
    />
  );
}

// LoginForm handles both sign in and sign up flows. Once the user successfully
// authenticates we'll call the provided `onLogin` callback so the parent can
// refetch the current user.
function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = isRegister ? 'register' : 'login';
      const body: any = { email, password };
      if (isRegister) body.username = username;
      const response = await fetch(`${SERVER_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const json = await response.json();
        setError(json.error || 'Failed');
        return;
      }
      setError(null);
      onLogin();
    } catch (e) {
      setError('Network error');
    }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-50">
      <div className="bg-white p-8 rounded-md shadow-md w-full max-w-md">
        <h2 className="text-2xl mb-4 text-center text-blue-600">
          {isRegister ? 'Sign Up' : 'Sign In'}
        </h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
          {isRegister && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            />
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
          <button type="submit" className="bg-blue-500 text-white py-2 rounded">
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsRegister((prev) => !prev)}
            className="text-blue-500 underline"
          >
            {isRegister ? 'Already have an account? Sign In' : 'New user? Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}

// A small hand crafted SVG used as the BerryTwitter logo. Keeping it simple for
// demonstration: a circle with an attached leaf.
function BerryIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="14" r="8" fill="#1DA1F2" />
      <path d="M12 6c2-2 6-2 6 2s-4 4-6 2-6-0-6-2 4-4 6-2z" fill="#1DA1F2" />
      <path d="M14 2c1 1 0 3-1 3s-2-2-1-3 2-1 2 0z" fill="#17BF63" />
    </svg>
  );
}

interface MainViewProps {
  user: User;
  view: 'feed' | 'profile';
  profileUser: any;
  openProfile: (username: string) => void;
  goToFeed: () => void;
  logout: () => void;
}

function MainView({ user, view, profileUser, openProfile, goToFeed, logout }: MainViewProps) {
  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-2">
          <BerryIcon />
          <span className="text-xl font-semibold text-blue-600">BerryTwitter</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>{user.username}</span>
          <button onClick={logout} className="text-sm text-red-500 underline">
            Logout
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-4">
        {view === 'feed' ? (
          <Feed openProfile={openProfile} />
        ) : (
          profileUser && <ProfileView user={profileUser} openProfile={openProfile} />
        )}
      </div>
      {view === 'profile' && (
        <footer className="p-2 border-t border-gray-200">
          <button onClick={goToFeed} className="text-blue-500 underline">
            {'< Back to Feed'}
          </button>
        </footer>
      )}
    </div>
  );
}

// Utility to convert a File to a data URL.
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

// TweetForm allows the authenticated user to post a new tweet. After submission
// we'll invalidate the 'tweets' query so the feed reloads.
function TweetForm() {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const queryClient = useQueryClient();
  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const arr = Array.from(e.target.files);
      setFiles(arr.slice(0, 4));
    }
  };
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const images: string[] = [];
    for (const file of files) {
      const url = await readFileAsDataURL(file);
      images.push(url);
    }
    await fetch(`${SERVER_URL}/api/tweets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, images }),
    });
    setText('');
    setFiles([]);
    queryClient.invalidateQueries({ queryKey: ['tweets'] });
  };
  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-2 mb-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="border border-gray-300 rounded p-2 resize-none"
        placeholder="What's happening?"
        rows={3}
        maxLength={280}
        required
      />
      <input type="file" multiple accept="image/*" onChange={handleFiles} />
      <button type="submit" className="self-end bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50" disabled={!text.trim() && files.length === 0}>
        Tweet
      </button>
    </form>
  );
}

interface Tweet {
  id: number;
  text: string;
  createdAt: number;
  user: {
    id: number;
    username: string;
    profilePhoto?: string;
  };
  images: string[];
}

interface FeedProps {
  openProfile: (username: string) => void;
}

function Feed({ openProfile }: FeedProps) {
  const { data: tweets, isLoading } = useQuery({
    queryKey: ['tweets'],
    queryFn: async (): Promise<Tweet[]> => {
      const response = await fetch(`${SERVER_URL}/api/tweets`);
      return await response.json();
    },
  });
  if (isLoading) return <div>Loading tweets...</div>;
  return (
    <div>
      <TweetForm />
      <div className="space-y-4">
        {tweets?.map((tweet) => (
          <TweetCard key={tweet.id} tweet={tweet} openProfile={openProfile} />
        ))}
      </div>
    </div>
  );
}

interface TweetCardProps {
  tweet: Tweet;
  openProfile: (username: string) => void;
}

function TweetCard({ tweet, openProfile }: TweetCardProps) {
  const [showComments, setShowComments] = useState(false);
  const { data: comments } = useQuery({
    queryKey: ['comments', tweet.id],
    queryFn: async () => {
      if (!showComments) return [];
      const response = await fetch(`${SERVER_URL}/api/tweets/${tweet.id}/comments`);
      return await response.json();
    },
    enabled: showComments,
  });
  const [commentText, setCommentText] = useState('');
  const queryClient = useQueryClient();
  const postComment = async (e: FormEvent) => {
    e.preventDefault();
    await fetch(`${SERVER_URL}/api/tweets/${tweet.id}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text: commentText }),
    });
    setCommentText('');
    // Refresh comments
    queryClient.invalidateQueries({ queryKey: ['comments', tweet.id] });
  };
  const likeTweet = async () => {
    await fetch(`${SERVER_URL}/api/tweets/${tweet.id}/like`, {
      method: 'POST',
      credentials: 'include',
    });
  };
  return (
    <Card>
      <CardHeader className="flex space-x-4">
        <div className="h-12 w-12 rounded-full bg-gray-300" />
        <div className="flex flex-col">
          <span
            className="font-semibold text-blue-600 cursor-pointer"
            onClick={() => openProfile(tweet.user.username)}
          >
            {tweet.user.username}
          </span>
          <span className="text-sm text-gray-500">
            {new Date(tweet.createdAt * 1000).toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 whitespace-pre-wrap">{tweet.text}</div>
        {tweet.images && tweet.images.length > 0 && (
          <div className="flex space-x-2 overflow-x-auto">
            {tweet.images.map((img: string, idx: number) => (
              <img key={idx} src={img} className="max-h-40 rounded" />
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex space-x-4">
        <button onClick={likeTweet} className="text-blue-500">Like</button>
        <button onClick={() => setShowComments((v) => !v)} className="text-blue-500">
          Comments
        </button>
      </CardFooter>
      {showComments && (
        <div className="p-4 border-t border-gray-200">
          {comments?.map((c: any) => (
            <div key={c.id} className="mb-2">
              <span
                className="font-semibold text-blue-600 cursor-pointer"
                onClick={() => openProfile(c.user.username)}
              >
                {c.user.username}
              </span>
              : {c.text}
            </div>
          ))}
          <form onSubmit={postComment} className="flex space-x-2">
            <input
              required
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1"
            />
            <button className="text-blue-500" type="submit">Post</button>
          </form>
        </div>
      )}
    </Card>
  );
}

interface ProfileViewProps {
  user: any;
  openProfile: (username: string) => void;
}
function ProfileView({ user, openProfile }: ProfileViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4 mb-4">
        <div className="h-16 w-16 rounded-full bg-gray-300" />
        <div>
          <h2 className="text-xl font-semibold">{user.username}</h2>
          <p className="text-gray-600">{user.description}</p>
        </div>
      </div>
      {user.tweets?.map((tweet: any) => (
        <TweetCard key={tweet.id} tweet={{...tweet, user: { id: user.id, username: user.username, profilePhoto: user.profilePhoto }}} openProfile={openProfile} />
      ))}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppImpl />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
