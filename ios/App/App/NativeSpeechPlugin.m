#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeSpeechPlugin, "NativeSpeech",
    CAP_PLUGIN_METHOD(speak, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startListening, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopListening, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getVoices, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(translate, CAPPluginReturnPromise);
)
