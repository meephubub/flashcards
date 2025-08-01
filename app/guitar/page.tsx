"use client"

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Guitar, 
  Music, 
  Play, 
  Pause, 
  Volume2, 
  Mic, 
  BookOpen, 
  Target,
  Clock,
  Star,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

interface Chord {
  name: string;
  diagram: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
}

interface PracticeExercise {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  category: string;
}

const commonChords: Chord[] = [
  {
    name: "C Major",
    diagram: [
      "x 3 2 0 1 0",
      "C Major"
    ],
    difficulty: "easy",
    category: "Major"
  },
  {
    name: "G Major", 
    diagram: [
      "3 2 0 0 0 3",
      "G Major"
    ],
    difficulty: "easy",
    category: "Major"
  },
  {
    name: "D Major",
    diagram: [
      "x x 0 2 3 2",
      "D Major"
    ],
    difficulty: "easy", 
    category: "Major"
  },
  {
    name: "A Minor",
    diagram: [
      "x 0 2 2 1 0",
      "A Minor"
    ],
    difficulty: "easy",
    category: "Minor"
  },
  {
    name: "E Major",
    diagram: [
      "0 2 2 1 0 0",
      "E Major"
    ],
    difficulty: "easy",
    category: "Major"
  },
  {
    name: "F Major",
    diagram: [
      "1 3 3 2 1 1",
      "F Major"
    ],
    difficulty: "medium",
    category: "Major"
  }
];

const practiceExercises: PracticeExercise[] = [
  {
    id: "1",
    title: "Basic Finger Exercises",
    description: "Practice finger independence and strength with simple patterns",
    difficulty: "beginner",
    duration: 10,
    category: "Technique"
  },
  {
    id: "2", 
    title: "Chord Transitions",
    description: "Practice switching between common chords smoothly",
    difficulty: "beginner",
    duration: 15,
    category: "Chords"
  },
  {
    id: "3",
    title: "Strumming Patterns",
    description: "Learn basic strumming patterns and rhythm",
    difficulty: "beginner", 
    duration: 20,
    category: "Rhythm"
  },
  {
    id: "4",
    title: "Barre Chord Practice",
    description: "Master the F major barre chord and variations",
    difficulty: "intermediate",
    duration: 25,
    category: "Chords"
  },
  {
    id: "5",
    title: "Fingerpicking Basics",
    description: "Learn basic fingerpicking patterns",
    difficulty: "intermediate",
    duration: 30,
    category: "Technique"
  }
];

const tuningNotes = ['E', 'A', 'D', 'G', 'B', 'E'];

export default function GuitarPage() {
  const [selectedChord, setSelectedChord] = useState<Chord | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTuningNote, setCurrentTuningNote] = useState(0);
  const [practiceProgress, setPracticeProgress] = useState(0);

  const renderChordDiagram = (chord: Chord) => {
    const strings = chord.diagram[0].split(' ');
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="grid grid-cols-6 gap-1 text-xs">
          {strings.map((note, index) => (
            <div key={index} className="w-8 h-8 flex items-center justify-center border rounded">
              {note === 'x' ? 'X' : note === '0' ? '○' : note}
            </div>
          ))}
        </div>
        <div className="text-sm font-medium">{chord.name}</div>
      </div>
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium':
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'hard':
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Guitar className="w-8 h-8 mr-3 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Guitar Learning Hub
            </h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Master the guitar with interactive lessons, chord diagrams, and practice exercises
          </p>
        </div>

        <Tabs defaultValue="chords" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chords">Chords</TabsTrigger>
            <TabsTrigger value="tuner">Tuner</TabsTrigger>
            <TabsTrigger value="practice">Practice</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          {/* Chords Tab */}
          <TabsContent value="chords" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Music className="w-5 h-5 mr-2" />
                  Chord Library
                </CardTitle>
                <CardDescription>
                  Learn essential guitar chords with interactive diagrams
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {commonChords.map((chord) => (
                    <Card 
                      key={chord.name}
                      className={`cursor-pointer transition-all hover:shadow-lg ${
                        selectedChord?.name === chord.name ? 'ring-2 ring-indigo-500' : ''
                      }`}
                      onClick={() => setSelectedChord(chord)}
                    >
                      <CardContent className="p-4">
                        {renderChordDiagram(chord)}
                        <div className="mt-2 flex justify-between items-center">
                          <Badge className={getDifficultyColor(chord.difficulty)}>
                            {chord.difficulty}
                          </Badge>
                          <Badge variant="outline">{chord.category}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedChord && (
                  <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2">{selectedChord.name}</h3>
                    <div className="flex items-center space-x-4">
                      <Button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="flex items-center space-x-2"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{isPlaying ? 'Stop' : 'Play'}</span>
                      </Button>
                      <Button variant="outline" className="flex items-center space-x-2">
                        <Volume2 className="w-4 h-4" />
                        <span>Listen</span>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tuner Tab */}
          <TabsContent value="tuner" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mic className="w-5 h-5 mr-2" />
                  Guitar Tuner
                </CardTitle>
                <CardDescription>
                  Tune your guitar with our interactive tuner
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-6">
                  <div className="text-6xl font-bold text-indigo-600 dark:text-indigo-400">
                    {tuningNotes[currentTuningNote]}
                  </div>
                  
                  <div className="flex justify-center space-x-2">
                    {tuningNotes.map((note, index) => (
                      <Button
                        key={note}
                        variant={currentTuningNote === index ? "default" : "outline"}
                        onClick={() => setCurrentTuningNote(index)}
                        className="w-12 h-12 rounded-full"
                      >
                        {note}
                      </Button>
                    ))}
                  </div>

                  <div className="flex justify-center space-x-4">
                    <Button 
                      onClick={() => setCurrentTuningNote(Math.max(0, currentTuningNote - 1))}
                      disabled={currentTuningNote === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      onClick={() => setCurrentTuningNote(Math.min(5, currentTuningNote + 1))}
                      disabled={currentTuningNote === 5}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex justify-center space-x-4">
                    <Button className="flex items-center space-x-2">
                      <Mic className="w-4 h-4" />
                      <span>Start Listening</span>
                    </Button>
                    <Button variant="outline" className="flex items-center space-x-2">
                      <Volume2 className="w-4 h-4" />
                      <span>Play Note</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Practice Tab */}
          <TabsContent value="practice" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Practice Exercises
                </CardTitle>
                <CardDescription>
                  Structured practice sessions to improve your guitar skills
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {practiceExercises.map((exercise) => (
                    <Card key={exercise.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-semibold">{exercise.title}</h3>
                              <Badge className={getDifficultyColor(exercise.difficulty)}>
                                {exercise.difficulty}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                              {exercise.description}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-4 h-4" />
                                <span>{exercise.duration} min</span>
                              </div>
                              <Badge variant="outline">{exercise.category}</Badge>
                            </div>
                          </div>
                          <Button className="flex items-center space-x-2">
                            <Play className="w-4 h-4" />
                            <span>Start</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Separator className="my-6" />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Today's Progress</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Practice Time</span>
                      <span>25 / 60 minutes</span>
                    </div>
                    <Progress value={42} className="w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BookOpen className="w-5 h-5 mr-2" />
                    Learning Path
                  </CardTitle>
                  <CardDescription>
                    Follow a structured learning path
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { title: "Basic Chords", completed: true, stars: 3 },
                      { title: "Strumming Patterns", completed: true, stars: 2 },
                      { title: "Barre Chords", completed: false, stars: 0 },
                      { title: "Fingerpicking", completed: false, stars: 0 },
                      { title: "Music Theory", completed: false, stars: 0 }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded border">
                        <span className={item.completed ? "line-through text-gray-500" : ""}>
                          {item.title}
                        </span>
                        <div className="flex items-center space-x-1">
                          {[...Array(3)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-4 h-4 ${
                                i < item.stars 
                                  ? "fill-yellow-400 text-yellow-400" 
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Tips</CardTitle>
                  <CardDescription>
                    Essential tips for guitar practice
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      "Practice for at least 15 minutes daily",
                      "Focus on accuracy over speed",
                      "Use a metronome for rhythm practice",
                      "Record yourself to track progress",
                      "Take breaks to avoid hand fatigue"
                    ].map((tip, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm">{tip}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 