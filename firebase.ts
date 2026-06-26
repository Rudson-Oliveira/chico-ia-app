

// FIX: Changed the import for `firebase/app` to a named import for `initializeApp` to align with the Firebase v9+ modular SDK.
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp, updateDoc, increment, collection, query, where, orderBy, addDoc, Timestamp, deleteDoc, getDocs, limit, getDoc, getDocFromServer } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Import the Firebase configuration
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
let app;
let auth: any;
let db: any;
let storage: any;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Usa o banco padrao quando o id e "(default)" ou vazio; senao, o banco nomeado.
    const dbId = firebaseConfig.firestoreDatabaseId;
    db = (!dbId || dbId === '(default)') ? getFirestore(app) : getFirestore(app, dbId);
    storage = getStorage(app);
} catch (error) {
    console.error("Firebase initialization failed:", error);
    // Provide mocks if initialization fails
    auth = {
        currentUser: null,
        onAuthStateChanged: (cb: any) => { cb(null); return () => {}; },
        signOut: async () => {}
    };
    db = {};
    storage = {};
}

export { auth, db, storage };

export enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
}

export interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
        userId: string | undefined;
        email: string | null | undefined;
        emailVerified: boolean | undefined;
        isAnonymous: boolean | undefined;
        tenantId: string | null | undefined;
        providerInfo: {
            providerId: string;
            displayName: string | null;
            email: string | null;
            photoUrl: string | null;
        }[];
    }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo: auth.currentUser?.providerData.map(provider => ({
                providerId: provider.providerId,
                displayName: provider.displayName,
                email: provider.email,
                photoUrl: provider.photoURL
            })) || []
        },
        operationType,
        path
    }
    // Degradacao graciosa: sem login/permissao o Firestore falha ("Missing or insufficient
    // permissions"). Apenas registramos um aviso e seguimos com estado em memoria/local,
    // sem propagar o erro para nao travar a UI (chat, voz, camera, tela, navegador interno).
    console.warn('Firestore indisponivel (degradando para estado local):', JSON.stringify(errInfo));
}

// Export firebase auth functions to be used in components
export {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    doc,
    onSnapshot,
    setDoc,
    serverTimestamp,
    updateDoc,
    increment,
    ref,
    uploadBytes,
    getDownloadURL,
    collection,
    query,
    where,
    orderBy,
    addDoc,
    Timestamp,
    deleteDoc,
    getDocs,
    limit,
    getDoc,
    getDocFromServer
};
