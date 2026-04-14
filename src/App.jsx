import React, { useState, useCallback, useEffect } from 'react';
import GoogleAuth from './components/GoogleAuth';
import Dashboard from './components/Dashboard';
import FoodLog from './components/FoodLog';
import WeightTracker from './components/WeightTracker';
import Trends from './components/Trends';
import Settings from './components/Settings';
import BottomNav from './components/BottomNav';
import FlameIcon from './components/FlameIcon';
import { db, getSetting, setSetting } from './lib/db';
import { getAllMealPlannerMeals } from './lib/mealPlannerData';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  // Check if already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authSetting = await db.userSettings
          .where('key')
          .equals('authenticated')
          .first();
        if (authSetting?.value === 'true') {
          setAuthenticated(true);
        }
      } catch (err) {
        console.error('Error checking auth:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Auto-sync meal planner meals on app load (once per day)
  useEffect(() => {
    const syncMeals = async () => {
      try {
        const lastSyncDate = await getSetting('mealPlannerLastSyncDate');
        const todayStr = new Date().toISOString().split('T')[0];

        // Only sync once per day
        if (lastSyncDate === todayStr) {
          return;
        }

        const allMeals = await getAllMealPlannerMeals();

        // Store in importedRecipes table (idempotent with bulkPut)
        await db.importedRecipes.bulkPut(
          allMeals.map(meal => ({
            id: meal.id,
            name: meal.name,
            source_app: 'meal_planner',
            cuisines: meal.cuisine,
            meal_times: meal.times,
            created_at: new Date().toISOString(),
          }))
        );

        // Update sync date
        await setSetting('mealPlannerLastSyncDate', todayStr);
      } catch (error) {
        console.error('Error syncing meal planner meals:', error);
      }
    };

    if (authenticated) {
      syncMeals();
    }
  }, [authenticated]);

  const handleAuth = useCallback(() => {
    setAuthenticated(true);
  }, []);

  const navigateTo = useCallback((tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="flame-pulse">
          <FlameIcon size={64} glow />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="loading-dot" style={{ animationDelay: '0s' }} />
          <div className="loading-dot" style={{ animationDelay: '0.2s' }} />
          <div className="loading-dot" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <GoogleAuth onAuthenticated={handleAuth} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <main className="pb-32" style={{ maxWidth: '32rem', margin: '0 auto', width: '100%' }}>
        {activeTab === 'dashboard' && <Dashboard onNavigate={navigateTo} />}
        {activeTab === 'foodlog' && <FoodLog />}
        {activeTab === 'weight' && <WeightTracker />}
        {activeTab === 'trends' && <Trends />}
        {activeTab === 'settings' && <Settings />}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={navigateTo} />
    </div>
  );
}
