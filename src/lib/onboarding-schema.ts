// Comprehensive Options Trading Onboarding Schema with Scoring System
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS } from './firestore-schema';

export interface OnboardingAnswers {
  // Step 1: Basic Profile
  tradingStartDate: 'less_than_3_months' | '3_to_12_months' | '1_to_3_years' | 'more_than_3_years';
  selfRatedSkill: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  tradingFrequency: 'daily' | 'weekly' | 'monthly' | 'occasionally';
  accountTypes: string[]; // Changed to array for multi-select
  
  // Step 2: Strategy & Knowledge (shown based on skill level)
  strategiesUsed: string[]; // Array of strategy IDs
  greeksKnowledge: 'none' | 'basic_understanding' | 'can_apply' | 'daily_use';
  riskManagementPlan: 'never' | 'sometimes' | 'always';
  
  // Risk & Money Management
  maxPortfolioPerTrade: 'more_than_10_percent' | '6_to_10_percent' | '3_to_5_percent' | '1_to_2_percent' | 'not_sure';
  positionSizingRules: 'no' | 'sometimes' | 'yes';
  
  // Step 3: Goals & Objectives
  primaryGoals: string[]; // Array of goal IDs
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  monthlyIncome: 'under_1000' | '1000_to_5000' | '5000_to_10000' | 'over_10000';
  
  // Step 4: Current Challenges (free text)
  currentChallenges: string;
  specificHelp: string;
  
  // Metadata
  completedAt: Date;
  version: string; // Schema version for future updates
}

export interface OnboardingScore {
  experienceScore: number;
  riskManagementScore: number;
  strategyDepthScore: number;
  totalScore: number;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  learningTrack: 'foundations' | 'growth' | 'optimization';
}

export interface UserProfile {
  answers: OnboardingAnswers;
  score: OnboardingScore;
  personalizedAdvice: PersonalizedAdvice;
  recommendedContent: RecommendedContent[];
}

export interface PersonalizedAdvice {
  welcomeMessage: string;
  keyFocusAreas: string[];
  immediateActions: string[];
  riskGuidelines: string[];
  strategySuggestions: string[];
}

export interface RecommendedContent {
  id: string;
  type: 'article' | 'video' | 'course' | 'tool' | 'template';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'basics' | 'risk_management' | 'strategies' | 'psychology' | 'tools';
}

// ==================== QUESTION DEFINITIONS ====================

export const ONBOARDING_QUESTIONS = {
  // Step 1: Basic Profile (everyone gets these)
  basic_profile: [
    {
      id: 'trading_start_date',
      question: 'When did you start trading options?',
      type: 'radio',
      required: true,
      options: [
        { value: 'less_than_3_months', label: 'Less than 3 months ago', score: 0 },
        { value: '3_to_12_months', label: '3-12 months ago', score: 1 },
        { value: '1_to_3_years', label: '1-3 years ago', score: 2 },
        { value: 'more_than_3_years', label: '3+ years ago', score: 3 }
      ]
    },
    {
      id: 'self_rated_skill',
      question: 'How would you rate your options trading skill level?',
      type: 'radio',
      required: true,
      options: [
        { value: 'beginner', label: 'Beginner', score: 0 },
        { value: 'intermediate', label: 'Intermediate', score: 1 },
        { value: 'advanced', label: 'Advanced', score: 2 },
        { value: 'expert', label: 'Expert', score: 3 }
      ]
    },
    {
      id: 'trading_frequency',
      question: 'How often do you trade options?',
      type: 'radio',
      required: true,
      options: [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'occasionally', label: 'Occasionally' }
      ]
    },
    {
      id: 'account_types',
      question: 'What types of accounts do you trade options in? (Select all that apply)',
      type: 'checkbox',
      required: true,
      options: [
        { value: 'individual', label: 'Individual Taxable Account' },
        { value: 'ira', label: 'Traditional IRA' },
        { value: 'roth_ira', label: 'Roth IRA' },
        { value: '401k', label: '401(k)' },
        { value: 'business', label: 'Business Account' },
        { value: 'trust', label: 'Trust Account' }
      ]
    }
  ],

  // Step 2: Strategy & Knowledge (conditional based on skill level)
  strategy_knowledge: [
    {
      id: 'strategies_used',
      question: 'Which options strategies have you used? (Select all that apply)',
      type: 'checkbox',
      required: false,
      conditional: { field: 'self_rated_skill', values: ['intermediate', 'advanced', 'expert'] },
      options: [
        { value: 'covered_calls', label: 'Covered Calls', score: 1 },
        { value: 'cash_secured_puts', label: 'Cash-Secured Puts', score: 1 },
        { value: 'protective_puts', label: 'Protective Puts', score: 1 },
        { value: 'bull_call_spread', label: 'Bull Call Spread', score: 2 },
        { value: 'bear_put_spread', label: 'Bear Put Spread', score: 2 },
        { value: 'iron_condor', label: 'Iron Condor', score: 2 },
        { value: 'calendar_spread', label: 'Calendar Spread', score: 2 },
        { value: 'straddle', label: 'Long/Short Straddle', score: 2 },
        { value: 'strangle', label: 'Long/Short Strangle', score: 2 },
        { value: 'ratio_spreads', label: 'Ratio Spreads', score: 3 },
        { value: 'diagonal_spreads', label: 'Diagonal Spreads', score: 3 },
        { value: 'leaps_hedging', label: 'LEAPS Hedging', score: 3 },
        { value: 'gamma_scalping', label: 'Gamma Scalping', score: 3 },
        { value: 'volatility_trading', label: 'Volatility Trading', score: 3 }
      ]
    },
    {
      id: 'greeks_knowledge',
      question: 'How well do you understand and use the Greeks (Delta, Gamma, Theta, Vega)?',
      type: 'radio',
      required: true,
      options: [
        { value: 'none', label: "I don't know what the Greeks are", score: 0 },
        { value: 'basic_understanding', label: 'Basic understanding but rarely use them', score: 1 },
        { value: 'can_apply', label: 'Can apply them in my trading decisions', score: 2 },
        { value: 'daily_use', label: 'Use Greeks daily in my trading decisions', score: 3 }
      ]
    },
    {
      id: 'risk_management_plan',
      question: 'Do you have a structured risk management plan?',
      type: 'radio',
      required: true,
      options: [
        { value: 'never', label: 'No, I trade based on gut feeling', score: 0 },
        { value: 'sometimes', label: 'Sometimes, but not consistently', score: 1 },
        { value: 'always', label: 'Yes, I always follow my risk rules', score: 3 }
      ]
    }
  ],

  // Risk & Money Management
  risk_management: [
    {
      id: 'max_portfolio_per_trade',
      question: 'What is the maximum percentage of your portfolio you risk on a single options trade?',
      type: 'radio',
      required: true,
      options: [
        { value: 'more_than_10_percent', label: 'More than 10%', score: 0 },
        { value: '6_to_10_percent', label: '6-10%', score: 1 },
        { value: '3_to_5_percent', label: '3-5%', score: 2 },
        { value: '1_to_2_percent', label: '1-2%', score: 3 },
        { value: 'not_sure', label: "I'm not sure", score: 0 }
      ]
    },
    {
      id: 'position_sizing_rules',
      question: 'Do you use consistent position sizing rules?',
      type: 'radio',
      required: true,
      options: [
        { value: 'no', label: 'No, I decide trade size based on confidence', score: 0 },
        { value: 'sometimes', label: 'Sometimes, but not always', score: 1 },
        { value: 'yes', label: 'Yes, I have consistent rules I follow', score: 3 }
      ]
    }
  ],

  // Step 3: Goals & Objectives
  goals_objectives: [
    {
      id: 'primary_goals',
      question: 'What are your primary goals with options trading? (Select all that apply)',
      type: 'checkbox',
      required: true,
      options: [
        { value: 'monthly_income', label: 'Generate monthly income' },
        { value: 'portfolio_growth', label: 'Grow my portfolio over time' },
        { value: 'hedge_positions', label: 'Hedge my stock positions' },
        { value: 'speculation', label: 'Speculative trading for big gains' },
        { value: 'tax_efficiency', label: 'Tax-efficient investing' },
        { value: 'learn_strategies', label: 'Learn new trading strategies' }
      ]
    },
    {
      id: 'risk_tolerance',
      question: 'How would you describe your risk tolerance?',
      type: 'radio',
      required: true,
      options: [
        { value: 'conservative', label: 'Conservative - Prefer steady, predictable returns' },
        { value: 'moderate', label: 'Moderate - Balanced approach to risk and reward' },
        { value: 'aggressive', label: 'Aggressive - Willing to take higher risks for higher rewards' }
      ]
    },
    {
      id: 'monthly_income',
      question: 'What monthly income goal do you have from options trading?',
      type: 'radio',
      required: false,
      options: [
        { value: 'under_1000', label: 'Under $1,000' },
        { value: '1000_to_5000', label: '$1,000 - $5,000' },
        { value: '5000_to_10000', label: '$5,000 - $10,000' },
        { value: 'over_10000', label: 'Over $10,000' }
      ]
    }
  ],

  // Step 4: Current Challenges
  challenges: [
    {
      id: 'current_challenges',
      question: 'What are your biggest challenges with options trading right now?',
      type: 'textarea',
      required: false,
      placeholder: 'e.g., Understanding when to exit trades, managing multiple positions, timing entries...'
    },
    {
      id: 'specific_help',
      question: 'What specific help are you looking for from Trade Insights Pro?',
      type: 'textarea',
      required: false,
      placeholder: 'e.g., Better trade tracking, automated alerts, strategy recommendations...'
    }
  ]
} as const;

// ==================== SCORING SYSTEM ====================

export class OnboardingScorer {
  static calculateScore(answers: Partial<OnboardingAnswers>): OnboardingScore {
    let experienceScore = 0;
    let riskManagementScore = 0;
    let strategyDepthScore = 0;

    // Experience Scoring
    const experienceMap = {
      'less_than_3_months': 0,
      '3_to_12_months': 1,
      '1_to_3_years': 2,
      'more_than_3_years': 3
    };
    experienceScore += experienceMap[answers.tradingStartDate || 'less_than_3_months'];

    const skillMap = {
      'beginner': 0,
      'intermediate': 1,
      'advanced': 2,
      'expert': 3
    };
    experienceScore += skillMap[answers.selfRatedSkill || 'beginner'];

    // Strategy count scoring
    const strategyCount = answers.strategiesUsed?.length || 0;
    if (strategyCount === 0 || strategyCount === 1) experienceScore += 0;
    else if (strategyCount <= 3) experienceScore += 1;
    else if (strategyCount <= 6) experienceScore += 2;
    else experienceScore += 3;

    const greeksMap = {
      'none': 0,
      'basic_understanding': 1,
      'can_apply': 2,
      'daily_use': 3
    };
    experienceScore += greeksMap[answers.greeksKnowledge || 'none'];

    const riskPlanMap = {
      'never': 0,
      'sometimes': 1,
      'always': 3
    };
    experienceScore += riskPlanMap[answers.riskManagementPlan || 'never'];

    // Risk Management Scoring
    const maxRiskMap = {
      'more_than_10_percent': 0,
      '6_to_10_percent': 1,
      '3_to_5_percent': 2,
      '1_to_2_percent': 3,
      'not_sure': 0
    };
    riskManagementScore += maxRiskMap[answers.maxPortfolioPerTrade || 'not_sure'];

    const positionSizingMap = {
      'no': 0,
      'sometimes': 1,
      'yes': 3
    };
    riskManagementScore += positionSizingMap[answers.positionSizingRules || 'no'];

    // Strategy Depth Scoring
    const strategyScores = {
      // Basic strategies (+1 each)
      'covered_calls': 1,
      'cash_secured_puts': 1,
      'protective_puts': 1,
      
      // Intermediate strategies (+2 each)
      'bull_call_spread': 2,
      'bear_put_spread': 2,
      'iron_condor': 2,
      'calendar_spread': 2,
      'straddle': 2,
      'strangle': 2,
      
      // Advanced strategies (+3 each)
      'ratio_spreads': 3,
      'diagonal_spreads': 3,
      'leaps_hedging': 3,
      'gamma_scalping': 3,
      'volatility_trading': 3
    };

    answers.strategiesUsed?.forEach(strategy => {
      strategyDepthScore += (strategyScores as any)[strategy] || 0;
    });

    const totalScore = experienceScore + riskManagementScore + strategyDepthScore;

    // Determine skill level and learning track
    let skillLevel: 'beginner' | 'intermediate' | 'advanced';
    let learningTrack: 'foundations' | 'growth' | 'optimization';

    if (totalScore <= 10) {
      skillLevel = 'beginner';
      learningTrack = 'foundations';
    } else if (totalScore <= 20) {
      skillLevel = 'intermediate';
      learningTrack = 'growth';
    } else {
      skillLevel = 'advanced';
      learningTrack = 'optimization';
    }

    return {
      experienceScore,
      riskManagementScore,
      strategyDepthScore,
      totalScore,
      skillLevel,
      learningTrack
    };
  }

  static generatePersonalizedAdvice(answers: OnboardingAnswers, score: OnboardingScore): PersonalizedAdvice {
    const advice: PersonalizedAdvice = {
      welcomeMessage: '',
      keyFocusAreas: [],
      immediateActions: [],
      riskGuidelines: [],
      strategySuggestions: []
    };

    // Generate advice based on skill level
    switch (score.learningTrack) {
      case 'foundations':
        advice.welcomeMessage = "Welcome to options trading! Let's build a solid foundation with proven strategies and risk management.";
        advice.keyFocusAreas = [
          'Understanding options basics and terminology',
          'Learning the Greeks and how they affect your trades',
          'Establishing proper risk management rules',
          'Starting with simple, high-probability strategies'
        ];
        advice.immediateActions = [
          'Set a maximum of 1-2% of portfolio per trade',
          'Start with covered calls or cash-secured puts',
          'Practice with paper trading first',
          'Learn to read option chains and understand bid/ask spreads'
        ];
        advice.riskGuidelines = [
          'Never risk more than 2% of your portfolio on a single trade',
          'Always have an exit plan before entering a trade',
          'Focus on high-probability, conservative strategies',
          'Keep detailed records of every trade'
        ];
        advice.strategySuggestions = [
          'Covered Calls: Generate income from stocks you own',
          'Cash-Secured Puts: Get paid while waiting to buy stocks',
          'Protective Puts: Insurance for your stock positions'
        ];
        break;

      case 'growth':
        advice.welcomeMessage = "Great progress! Let's expand your strategy toolkit and improve consistency.";
        advice.keyFocusAreas = [
          'Mastering spread strategies for better risk/reward',
          'Understanding implied volatility and timing',
          'Developing consistent position sizing rules',
          'Learning to roll and adjust positions'
        ];
        advice.immediateActions = [
          'Practice vertical spreads to reduce risk',
          'Learn to use implied volatility in strategy selection',
          'Develop a systematic approach to trade management',
          'Start tracking win rate and profit factor metrics'
        ];
        advice.riskGuidelines = [
          'Consider using spreads to limit maximum loss',
          'Pay attention to implied volatility levels',
          'Have clear rules for when to close trades early',
          'Diversify across different strategies and timeframes'
        ];
        advice.strategySuggestions = [
          'Iron Condors: Profit from sideways movement',
          'Calendar Spreads: Benefit from time decay',
          'Vertical Spreads: Defined risk strategies'
        ];
        break;

      case 'optimization':
        advice.welcomeMessage = "Excellent! Let's optimize your approach and explore advanced techniques.";
        advice.keyFocusAreas = [
          'Portfolio-level Greeks management',
          'Advanced volatility strategies',
          'Capital efficiency optimization',
          'Systematic trade selection and sizing'
        ];
        advice.immediateActions = [
          'Implement portfolio-level risk monitoring',
          'Explore volatility-based strategy selection',
          'Consider advanced spreads and combinations',
          'Optimize capital allocation across strategies'
        ];
        advice.riskGuidelines = [
          'Monitor portfolio Greeks daily',
          'Use volatility forecasting in strategy selection',
          'Implement systematic position sizing based on Kelly Criterion',
          'Consider correlation effects across positions'
        ];
        advice.strategySuggestions = [
          'Ratio Spreads: Profit from specific price targets',
          'Diagonal Spreads: Advanced time decay strategies',
          'Volatility Trading: Profit from volatility changes'
        ];
        break;
    }

    // Customize based on specific goals
    if (answers.primaryGoals?.includes('monthly_income')) {
      advice.strategySuggestions.unshift('Focus on theta-positive strategies like covered calls and iron condors');
    }
    
    if (answers.primaryGoals?.includes('hedge_positions')) {
      advice.strategySuggestions.push('Use protective puts and collars to hedge stock positions');
    }

    // Adjust based on risk tolerance
    if (answers.riskTolerance === 'conservative') {
      advice.riskGuidelines.unshift('Stick to high-probability trades with limited downside');
    } else if (answers.riskTolerance === 'aggressive') {
      advice.riskGuidelines.push('Even with aggressive goals, maintain strict position sizing');
    }

    return advice;
  }

  static getRecommendedContent(score: OnboardingScore, answers: OnboardingAnswers): RecommendedContent[] {
    const content: RecommendedContent[] = [];

    // Content based on learning track
    switch (score.learningTrack) {
      case 'foundations':
        content.push(
          {
            id: 'options_basics_course',
            type: 'course',
            title: 'Options Trading Fundamentals',
            description: 'Complete guide to options basics, terminology, and simple strategies',
            priority: 'high',
            category: 'basics'
          },
          {
            id: 'greeks_guide',
            type: 'article',
            title: 'Understanding the Greeks',
            description: 'Learn how Delta, Gamma, Theta, and Vega affect your trades',
            priority: 'high',
            category: 'basics'
          },
          {
            id: 'risk_management_template',
            type: 'template',
            title: 'Risk Management Checklist',
            description: 'Template for creating your personal risk management rules',
            priority: 'high',
            category: 'risk_management'
          }
        );
        break;

      case 'growth':
        content.push(
          {
            id: 'spread_strategies_guide',
            type: 'course',
            title: 'Mastering Spread Strategies',
            description: 'Advanced guide to vertical spreads, iron condors, and calendars',
            priority: 'high',
            category: 'strategies'
          },
          {
            id: 'iv_analysis_tool',
            type: 'tool',
            title: 'Implied Volatility Scanner',
            description: 'Find opportunities based on implied volatility levels',
            priority: 'medium',
            category: 'tools'
          }
        );
        break;

      case 'optimization':
        content.push(
          {
            id: 'portfolio_greeks_dashboard',
            type: 'tool',
            title: 'Portfolio Greeks Monitor',
            description: 'Track portfolio-level Greeks exposure in real-time',
            priority: 'high',
            category: 'tools'
          },
          {
            id: 'advanced_strategies_course',
            type: 'course',
            title: 'Advanced Options Strategies',
            description: 'Ratio spreads, diagonals, and volatility trading techniques',
            priority: 'medium',
            category: 'strategies'
          }
        );
        break;
    }

    // Add content based on specific challenges
    if (answers.currentChallenges?.toLowerCase().includes('exit')) {
      content.push({
        id: 'exit_strategies_guide',
        type: 'article',
        title: 'When and How to Exit Options Trades',
        description: 'Systematic approach to profit-taking and loss-cutting',
        priority: 'high',
        category: 'strategies'
      });
    }

    if (answers.currentChallenges?.toLowerCase().includes('timing')) {
      content.push({
        id: 'timing_guide',
        type: 'article',
        title: 'Options Entry and Exit Timing',
        description: 'Use technical analysis and Greeks for better timing',
        priority: 'medium',
        category: 'strategies'
      });
    }

    return content;
  }
}

// ==================== DYNAMIC FLOW LOGIC ====================

export class OnboardingFlow {
  static getQuestionsForStep(step: number, currentAnswers: Partial<OnboardingAnswers>) {
    switch (step) {
      case 0:
        return [...ONBOARDING_QUESTIONS.basic_profile];
      
      case 1:
        // Show strategy questions only for intermediate+ users
        if (currentAnswers.selfRatedSkill && ['intermediate', 'advanced', 'expert'].includes(currentAnswers.selfRatedSkill)) {
          return [...ONBOARDING_QUESTIONS.strategy_knowledge];
        }
        // Skip to risk management for beginners
        return [...ONBOARDING_QUESTIONS.risk_management];
      
      case 2:
        // If we showed strategy questions, now show risk management
        if (currentAnswers.selfRatedSkill && ['intermediate', 'advanced', 'expert'].includes(currentAnswers.selfRatedSkill)) {
          return [...ONBOARDING_QUESTIONS.risk_management];
        }
        // Otherwise show goals
        return [...ONBOARDING_QUESTIONS.goals_objectives];
      
      case 3:
        return [...ONBOARDING_QUESTIONS.goals_objectives];
      
      case 4:
        return [...ONBOARDING_QUESTIONS.challenges];
      
      default:
        return [];
    }
  }

  static getTotalSteps(answers: Partial<OnboardingAnswers>): number {
    // Beginners: Basic (0) -> Risk (1) -> Goals (2) -> Challenges (3) = 4 steps
    // Intermediate+: Basic (0) -> Strategy (1) -> Risk (2) -> Goals (3) -> Challenges (4) = 5 steps
    return answers.selfRatedSkill && ['intermediate', 'advanced', 'expert'].includes(answers.selfRatedSkill) ? 5 : 4;
  }

  static isComplete(answers: Partial<OnboardingAnswers>): boolean {
    const required = ['tradingStartDate', 'selfRatedSkill', 'greeksKnowledge', 'riskManagementPlan', 'maxPortfolioPerTrade', 'positionSizingRules'];
    return required.every(field => (answers as any)[field] !== undefined);
  }

  static createUserProfile(answers: OnboardingAnswers): UserProfile {
    const score = OnboardingScorer.calculateScore(answers);
    const personalizedAdvice = OnboardingScorer.generatePersonalizedAdvice(answers, score);
    const recommendedContent = OnboardingScorer.getRecommendedContent(score, answers);

    return {
      answers,
      score,
      personalizedAdvice,
      recommendedContent
    };
  }
}

// ==================== FIRESTORE INTEGRATION ====================

export interface FirestoreUserProfile extends UserProfile {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class OnboardingService {
  static async saveUserProfile(userId: string, profile: UserProfile) {
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.INFORMATION, 'onboarding_profile');
    await setDoc(docRef, {
      ...profile,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  static async getUserProfile(userId: string): Promise<FirestoreUserProfile | null> {
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.INFORMATION, 'onboarding_profile');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as FirestoreUserProfile;
    }
    return null;
  }

  static async updateUserProfile(userId: string, updates: Partial<UserProfile>) {
    const docRef = doc(db, COLLECTIONS.SNAPTRADE_USERS, userId, COLLECTIONS.INFORMATION, 'onboarding_profile');
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date()
    });
  }
}