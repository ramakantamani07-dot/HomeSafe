Pod::Spec.new do |s|
  s.name           = 'WalkingDirections'
  s.version        = '1.0.0'
  s.summary        = 'Walking routes via MapKit'
  s.description    = 'Wraps MKDirections so wayLoc gets real walking routes without a routing server or an API key.'
  s.author         = ''
  s.homepage       = 'https://wayloc.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
